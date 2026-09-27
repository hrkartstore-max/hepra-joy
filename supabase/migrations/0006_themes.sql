-- Phase 7: ten ready-made themes using one shared theme engine.
insert into public.themes(name,slug,description,category,preview_image_url,active)
values
('Fashion','fashion','Editorial fashion storefront','Fashion',null,true),
('Saree & Ethnic','saree-ethnic','Traditional and ethnic commerce storefront','Saree & Ethnic',null,true),
('Beauty & Cosmetics','beauty-cosmetics','Clean beauty and cosmetics storefront','Beauty & Cosmetics',null,true),
('Jewellery','jewellery','Premium jewellery storefront','Jewellery',null,true),
('Optical','optical','Modern eyewear storefront','Optical',null,true),
('Electronics','electronics','Product-first electronics storefront','Electronics',null,true),
('Grocery','grocery','Fast shopping grocery storefront','Grocery',null,true),
('Restaurant & Food','restaurant-food','Menu-first food storefront','Restaurant / Food',null,true),
('Home & Lifestyle','home-lifestyle','Warm home and lifestyle storefront','Home & Lifestyle',null,true),
('Minimal D2C','minimal-d2c','Minimal direct-to-consumer storefront','Minimal D2C',null,true)
on conflict(slug) do update set name=excluded.name,description=excluded.description,category=excluded.category,active=true;

insert into public.theme_versions(theme_id,version,config)
select t.id,'1.0.0',
jsonb_build_object(
  'engine_version','1',
  'header',jsonb_build_object('style',
    case t.slug when 'luxury-jewellery' then 'centered' when 'restaurant-food' then 'compact' else 'standard' end),
  'hero',jsonb_build_object('enabled',true,'layout',
    case t.slug when 'minimal-d2c' then 'split' when 'electronics' then 'product-focus' else 'editorial' end),
  'product_grid',jsonb_build_object('columns_mobile',2,'columns_desktop',
    case t.slug when 'grocery' then 5 when 'fashion' then 4 when 'optical' then 4 else 4 end),
  'radius',case t.slug when 'jewellery' then 'xl' when 'minimal-d2c' then 'md' else '2xl' end,
  'accent',case t.slug when 'optical' then '#071B49' when 'jewellery' then '#B08D2C' when 'beauty-cosmetics' then '#C0266B' when 'restaurant-food' then '#B45309' when 'electronics' then '#2563EB' when 'grocery' then '#15803D' when 'home-lifestyle' then '#92400E' when 'saree-ethnic' then '#9F1239' when 'fashion' then '#400378' else '#111827' end,
  'features',jsonb_build_object('responsive',true,'collections',true,'product',true,'cart',true,'checkout',true,'account',true,'navigation',true,'footer',true)
)
from public.themes t
where not exists(select 1 from public.theme_versions v where v.theme_id=t.id and v.version='1.0.0');

alter table public.themes add column if not exists config jsonb not null default '{}'::jsonb;
