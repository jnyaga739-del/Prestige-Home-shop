/* =========================================================
   PRESTIGE HOME DEALS
   SUPABASE DATABASE
   ========================================================= */


/* =========================================================
   EXTENSIONS
   ========================================================= */

create extension if not exists pgcrypto;


/* =========================================================
   PRODUCTS
   ========================================================= */

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  slug text unique,

  description text not null default '',

  price numeric(12,2) not null
    check (price >= 0),

  old_price numeric(12,2)
    check (old_price is null or old_price >= 0),

  category text not null default 'General',

  image_url text,

  stock integer not null default 0
    check (stock >= 0),

  featured boolean not null default false,

  active boolean not null default true,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


/* =========================================================
   ADMINS
   ========================================================= */

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id)
    on delete cascade,

  created_at timestamptz not null default now()
);


/* =========================================================
   ORDERS
   ========================================================= */

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),

  customer_name text not null,

  phone text not null,

  email text,

  county text not null,

  town text not null,

  delivery_address text not null,

  notes text,

  total numeric(12,2) not null default 0
    check (total >= 0),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
      )
    ),

  payment_status text not null default 'unpaid'
    check (
      payment_status in (
        'unpaid',
        'paid',
        'refunded'
      )
    ),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


/* =========================================================
   ORDER ITEMS
   ========================================================= */

create table if not exists public.order_items (

  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  product_id uuid
    references public.products(id)
    on delete set null,

  product_name text not null,

  unit_price numeric(12,2) not null
    check (unit_price >= 0),

  quantity integer not null
    check (quantity > 0),

  subtotal numeric(12,2) not null
    check (subtotal >= 0),

  created_at timestamptz not null default now()
);


/* =========================================================
   UPDATED_AT FUNCTION
   ========================================================= */

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin

  new.updated_at = now();

  return new;

end;
$$;


/* =========================================================
   UPDATED_AT TRIGGERS
   ========================================================= */

drop trigger if exists products_updated_at
on public.products;

create trigger products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();


drop trigger if exists orders_updated_at
on public.orders;

create trigger orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();


/* =========================================================
   ADMIN CHECK
   ========================================================= */

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admins
    where user_id = auth.uid()
  );
$$;


/* =========================================================
   ENABLE ROW LEVEL SECURITY
   ========================================================= */

alter table public.products enable row level security;

alter table public.admins enable row level security;

alter table public.orders enable row level security;

alter table public.order_items enable row level security;


/* =========================================================
   REMOVE OLD POLICIES
   ========================================================= */

drop policy if exists
"Public can view active products"
on public.products;

drop policy if exists
"Admins can view all products"
on public.products;

drop policy if exists
"Admins can insert products"
on public.products;

drop policy if exists
"Admins can update products"
on public.products;

drop policy if exists
"Admins can delete products"
on public.products;

drop policy if exists
"Users can read own admin record"
on public.admins;

drop policy if exists
"Admins can view orders"
on public.orders;

drop policy if exists
"Admins can update orders"
on public.orders;

drop policy if exists
"Admins can view order items"
on public.order_items;


/* =========================================================
   PRODUCT POLICIES
   ========================================================= */

create policy
"Public can view active products"

on public.products

for select

to anon, authenticated

using (
  active = true
);


create policy
"Admins can view all products"

on public.products

for select

to authenticated

using (
  public.is_admin()
);


create policy
"Admins can insert products"

on public.products

for insert

to authenticated

with check (
  public.is_admin()
);


create policy
"Admins can update products"

on public.products

for update

to authenticated

using (
  public.is_admin()
)

with check (
  public.is_admin()
);


create policy
"Admins can delete products"

on public.products

for delete

to authenticated

using (
  public.is_admin()
);


/* =========================================================
   ADMIN TABLE POLICY
   ========================================================= */

create policy
"Users can read own admin record"

on public.admins

for select

to authenticated

using (
  user_id = auth.uid()
);


/* =========================================================
   ORDER POLICIES
   ========================================================= */

create policy
"Admins can view orders"

on public.orders

for select

to authenticated

using (
  public.is_admin()
);


create policy
"Admins can update orders"

on public.orders

for update

to authenticated

using (
  public.is_admin()
)

with check (
  public.is_admin()
);


/* =========================================================
   ORDER ITEM POLICIES
   ========================================================= */

create policy
"Admins can view order items"

on public.order_items

for select

to authenticated

using (
  public.is_admin()
);


/* =========================================================
   SECURE ORDER CREATION FUNCTION
   ========================================================= */

create or replace function public.create_order(
  p_customer_name text,
  p_phone text,
  p_email text,
  p_county text,
  p_town text,
  p_address text,
  p_notes text,
  p_items jsonb
)
returns uuid

language plpgsql

security definer

set search_path = public, pg_temp

as $$

declare

  v_order_id uuid;

  v_total numeric(12,2) := 0;

  v_item jsonb;

  v_product public.products%rowtype;

  v_product_id uuid;

  v_quantity integer;

  v_subtotal numeric(12,2);

begin

  /* BASIC VALIDATION */

  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Customer name is required';
  end if;

  if coalesce(trim(p_phone), '') = '' then
    raise exception 'Phone number is required';
  end if;

  if coalesce(trim(p_county), '') = '' then
    raise exception 'County is required';
  end if;

  if coalesce(trim(p_town), '') = '' then
    raise exception 'Town is required';
  end if;

  if coalesce(trim(p_address), '') = '' then
    raise exception 'Delivery address is required';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then

    raise exception 'At least one product is required';

  end if;


  /* CREATE ORDER */

  insert into public.orders (
    customer_name,
    phone,
    email,
    county,
    town,
    delivery_address,
    notes,
    total
  )

  values (
    trim(p_customer_name),
    trim(p_phone),
    nullif(trim(p_email), ''),
    trim(p_county),
    trim(p_town),
    trim(p_address),
    nullif(trim(p_notes), ''),
    0
  )

  returning id into v_order_id;


  /* PROCESS PRODUCTS */

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop

    v_product_id :=
      (v_item->>'product_id')::uuid;

    v_quantity :=
      coalesce(
        (v_item->>'quantity')::integer,
        1
      );

    if v_quantity < 1 then
      v_quantity := 1;
    end if;

    if v_quantity > 99 then
      v_quantity := 99;
    end if;


    /* GET CURRENT PRODUCT */

    select *
    into v_product

    from public.products

    where id = v_product_id

      and active = true;


    if not found then

      raise exception
        'Product is no longer available';

    end if;


    /* STOCK CHECK */

    if v_product.stock < v_quantity then

      raise exception
        'Insufficient stock for product: %',
        v_product.name;

    end if;


    /* CALCULATE SUBTOTAL */

    v_subtotal :=
      v_product.price * v_quantity;


    /* INSERT ORDER ITEM */

    insert into public.order_items (

      order_id,

      product_id,

      product_name,

      unit_price,

      quantity,

      subtotal

    )

    values (

      v_order_id,

      v_product.id,

      v_product.name,

      v_product.price,

      v_quantity,

      v_subtotal

    );


    v_total :=
      v_total + v_subtotal;

  end loop;


  /* UPDATE TOTAL */

  update public.orders

  set total = v_total

  where id = v_order_id;


  return v_order_id;

end;

$$;


/* =========================================================
   FUNCTION PERMISSIONS
   ========================================================= */

revoke all
on function public.create_order(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
from public;


grant execute
on function public.create_order(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
to anon;


grant execute
on function public.create_order(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
to authenticated;


/* =========================================================
   SAMPLE PRODUCTS
   ========================================================= */

insert into public.products
(
  name,
  slug,
  description,
  price,
  old_price,
  category,
  stock,
  featured,
  active
)

values

(
  'Smartpro 90L Fridge SFR-120-DT-I',
  'smartpro-90l-fridge',
  'Compact 90L refrigerator suitable for home use.',
  19000,
  null,
  'Fridges',
  10,
  true,
  true
),

(
  'Skyworth 90L Fridge',
  'skyworth-90l-fridge',
  'Compact Skyworth 90L refrigerator for everyday home use.',
  19000,
  null,
  'Fridges',
  10,
  true,
  true
),

(
  'Nunix A1C Water Dispenser',
  'nunix-a1c-dispenser',
  'Practical water dispenser for home and office use.',
  11000,
  null,
  'Water Dispensers',
  10,
  true,
  true
),

(
  'Electromate Dispenser + Coffee Maker',
  'electromate-dispenser-coffee-maker',
  'Multi-purpose dispenser and coffee maker.',
  10800,
  null,
  'Water Dispensers',
  10,
  false,
  true
),

(
  '43 Inch Xgimi Android TV',
  '43-inch-xgimi-android-tv',
  '43 inch Android smart TV for entertainment at home.',
  19999,
  null,
  'Televisions',
  10,
  true,
  true
),

(
  'Olelon 4+1 Cooker',
  'olelon-4-plus-1-cooker',
  '4 gas burners plus electric oven cooker.',
  10999,
  null,
  'Cookers',
  10,
  true,
  true
),

(
  'Hisense 6L Pressure Cooker',
  'hisense-6l-pressure-cooker',
  '6 litre pressure cooker for convenient home cooking.',
  8500,
  null,
  'Cookware',
  10,
  false,
  true
),

(
  'Bosch Granite 10 Piece Set',
  'bosch-granite-10-piece-set',
  'Granite cookware set for everyday kitchen use.',
  8200,
  8500,
  'Cookware',
  10,
  false,
  true
),

(
  'Globalstar 50x55 3+1 Cooker',
  'globalstar-50x55-3-plus-1-cooker',
  '50x55 cooker with 3 gas burners and 1 electric plate.',
  23000,
  null,
  'Cookers',
  10,
  true,
  true
),

(
  'Haier 3 Gas + 1 Electric Cooker',
  'haier-3-gas-1-electric-cooker',
  'Haier cooker with 3 gas burners and 1 electric plate.',
  34500,
  null,
  'Cookers',
  10,
  true,
  true
),

(
  'Mika 6kg Washing Machine',
  'mika-6kg-washing-machine',
  '6kg washing machine suitable for home laundry.',
  16500,
  null,
  'Washing Machines',
  10,
  true,
  true
),

(
  'RAF Blender',
  'raf-blender',
  'Kitchen blender for everyday food preparation.',
  2999,
  2700,
  'Kitchen Appliances',
  10,
  false,
  true
),

(
  'RAF Juicer',
  'raf-juicer',
  'Juicer for preparing fresh fruit and vegetable drinks.',
  6000,
  null,
  'Kitchen Appliances',
  10,
  false,
  true
)

on conflict (slug)
do nothing;


/* =========================================================
   DONE
   ========================================================= */
