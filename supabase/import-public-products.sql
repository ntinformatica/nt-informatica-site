-- Importacao gerada automaticamente a partir de public/produtos/app.js
-- Gerado em 2026-07-08T23:41:40.306Z
-- Seguro para executar mais de uma vez: categorias e produtos usam slug; variacoes usam verificacao por produto + nome/cor/sku.

begin;

insert into public.categories (name, slug, description, icon, sort_order, active)
values
  ('Monitores', 'monitores', 'Telas para trabalho, estudo e jogos.', '/category-assets/monitores.svg', 1, true),
  ('Teclados', 'teclados', 'Modelos gamer, mecânicos e de escritório.', '/category-assets/teclados.svg', 2, true),
  ('Mouses', 'mouses', 'Precisão para jogos e produtividade.', '/category-assets/mouses.svg', 3, true),
  ('Headsets', 'headsets', 'Áudio, microfone e conforto para jogar.', '/category-assets/headsets.svg', 4, true),
  ('Gabinetes', 'gabinetes', 'Visual gamer e boa refrigeração.', '/category-assets/gabinetes.svg', 5, true),
  ('SSDs', 'ssds', 'Mais velocidade para PC e notebook.', '/category-assets/ssds.svg', 6, true),
  ('Memórias RAM', 'memorias-ram', 'Upgrades para desempenho e multitarefa.', '/category-assets/memorias.svg', 7, true),
  ('Fontes', 'fontes', 'Energia estável para seu computador.', '/category-assets/fontes.svg', 8, true),
  ('Controles', 'controles', 'Controles para PC, consoles e games.', '/category-assets/controles.svg', 9, true),
  ('Carregadores e cabos', 'carregadores-e-cabos', 'Carregadores, fontes, HDMI, USB e adaptadores.', '/category-assets/carregadores.svg', 10, true),
  ('Kits e combos', 'kits-e-combos', 'Combos gamer e kits para escritório.', '/category-assets/kits.svg', 11, true),
  ('Acessórios gamer', 'acessorios-gamer', 'Itens para completar seu setup.', '/category-assets/acessorios.svg', 12, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- Produto: Monitor Gamer LG UltraGear 32GN600-B 32" QHD 165Hz
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Monitor Gamer LG UltraGear 32GN600-B 32" QHD 165Hz',
  'monitor-lg-ultragear-32gn600-b',
  (select id from public.categories where slug = 'monitores' limit 1),
  'LG',
  null,
  '32" QHD, 165Hz, 1ms MBR, HDR10 e FreeSync Premium.',
  'Monitor gamer de 32 polegadas com resolução QHD, taxa de atualização de 165Hz, resposta de 1ms MBR, HDR10 e recursos para jogos mais fluidos.

Especificações:
- Tela 32 polegadas VA
- Resolução QHD 2560 x 1440
- Taxa de atualização 165Hz
- Tempo de resposta 1ms MBR
- HDR10 e sRGB 95%
- AMD FreeSync Premium
- Compatibilidade G-Sync
- 2x HDMI, 1x DisplayPort e saída para fone
- VESA 100 x 100 mm',
  1500.00,
  1275.00,
  'disponível',
  0,
  false,
  'monitor-lg-ultragear-32gn600-b',
  'Consultar garantia na loja',
  'https://images5.kabum.com.br/produtos/fotos/364835/monitor-gamer-lg-ultragear-32-led-165-hz-qhd-1ms-hdmi-displayport-95-srgb-freesync-premium-hdr-10-vesa-preto-32gn600-b_1715801726_gg.jpg',
  array['https://images5.kabum.com.br/produtos/fotos/364835/monitor-gamer-lg-ultragear-32-led-165-hz-qhd-1ms-hdmi-displayport-95-srgb-freesync-premium-hdr-10-vesa-preto-32gn600-b_1715801726_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/364835/monitor-gamer-lg-ultragear-32-led-165-hz-qhd-1ms-hdmi-displayport-95-srgb-freesync-premium-hdr-10-vesa-preto-32gn600-b_1715801727_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/364835/monitor-gamer-lg-ultragear-32-led-165-hz-qhd-1ms-hdmi-displayport-95-srgb-freesync-premium-hdr-10-vesa-preto-32gn600-b_1715801725_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/364835/monitor-gamer-lg-ultragear-32-led-165-hz-qhd-1ms-hdmi-displayport-95-srgb-freesync-premium-hdr-10-vesa-preto-32gn600-b_1715801729_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/364835/monitor-gamer-lg-ultragear-32-led-165-hz-qhd-1ms-hdmi-displayport-95-srgb-freesync-premium-hdr-10-vesa-preto-32gn600-b_1715801730_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/364835/monitor-gamer-lg-ultragear-32-165hz-qhd-1ms-displayport-e-hdmi-95-srgb-freesync-premium-hdr-10-vesa-preto-32gn600-b_1753270455_gg.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Monitor Gamer Samsung Odyssey G3 24" Full HD 144Hz
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Monitor Gamer Samsung Odyssey G3 24" Full HD 144Hz',
  'monitor-samsung-odyssey-g3-24-lf24g35',
  (select id from public.categories where slug = 'monitores' limit 1),
  'G3',
  null,
  '24" Full HD, 144Hz, 1ms, FreeSync Premium e ajuste de altura.',
  'Monitor gamer Samsung Odyssey G3 de 24 polegadas com painel VA Full HD, 144Hz, tempo de resposta de 1ms, FreeSync Premium e base com regulagem de altura para mais conforto no setup.

Especificações:
- Tela 24 polegadas VA
- Resolução Full HD 1920 x 1080
- Taxa de atualização 144Hz
- Tempo de resposta 1ms
- AMD FreeSync Premium
- Eye Saver Mode e Flicker Free
- 1x HDMI, 1x DisplayPort, 1x VGA e saída para fone
- Base com ajuste de altura
- VESA 100 x 100 mm',
  800.00,
  680.00,
  'disponível',
  0,
  false,
  'monitor-samsung-odyssey-g3-24-lf24g35',
  'Consultar garantia na loja',
  'https://images2.kabum.com.br/produtos/fotos/sync_mirakl/232252/xlarge/Monitor-Gamer-Samsung-Odyssey-G3-24Pol-Full-HD-144-Hz-1MS-HDMI-Display-Port-VGA-Freesync-Premium-Regulagem-De-Altura-LF24G35TFWLXZD_1773256130.jpg',
  array['https://images2.kabum.com.br/produtos/fotos/sync_mirakl/232252/xlarge/Monitor-Gamer-Samsung-Odyssey-G3-24Pol-Full-HD-144-Hz-1MS-HDMI-Display-Port-VGA-Freesync-Premium-Regulagem-De-Altura-LF24G35TFWLXZD_1773256130.jpg', 'https://images2.kabum.com.br/produtos/fotos/sync_mirakl/232252/xlarge/Monitor-Gamer-Samsung-Odyssey-G3-24Pol-Full-HD-144-Hz-1MS-HDMI-Display-Port-VGA-Freesync-Premium-Regulagem-De-Altura-LF24G35TFWLXZD_1773256131.jpg', 'https://images2.kabum.com.br/produtos/fotos/sync_mirakl/232252/xlarge/Monitor-Gamer-Samsung-Odyssey-G3-24Pol-Full-HD-144-Hz-1MS-HDMI-Display-Port-VGA-Freesync-Premium-Regulagem-De-Altura-LF24G35TFWLXZD_1773256132.jpg', 'https://images2.kabum.com.br/produtos/fotos/sync_mirakl/232252/xlarge/Monitor-Gamer-Samsung-Odyssey-G3-24Pol-Full-HD-144-Hz-1MS-HDMI-Display-Port-VGA-Freesync-Premium-Regulagem-De-Altura-LF24G35TFWLXZD_1773256134.jpg', 'https://images2.kabum.com.br/produtos/fotos/sync_mirakl/232252/xlarge/Monitor-Gamer-Samsung-Odyssey-G3-24Pol-Full-HD-144-Hz-1MS-HDMI-Display-Port-VGA-Freesync-Premium-Regulagem-De-Altura-LF24G35TFWLXZD_1773256135.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Monitor Gamer SuperFrame View 24" Full HD 200Hz
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Monitor Gamer SuperFrame View 24" Full HD 200Hz',
  'monitor-superframe-view-24-200hz',
  (select id from public.categories where slug = 'monitores' limit 1),
  'SF',
  null,
  '24" Full HD, 200Hz, 1ms, Fast IPS, 99% sRGB e FreeSync.',
  'Monitor gamer SuperFrame View de 24 polegadas com painel Fast IPS, resolução Full HD, taxa de atualização de 200Hz, resposta de 1ms, 99% sRGB e suporte a FreeSync para jogos mais fluidos.

Especificações:
- Tela 24 polegadas Fast IPS
- Resolução Full HD 1920 x 1080
- Taxa de atualização 200Hz
- Tempo de resposta 1ms OD
- 99% sRGB
- Suporte HDR
- AMD FreeSync / Adaptive-Sync
- 1x HDMI 2.0, 1x DisplayPort 1.4 e saída de áudio
- VESA 100 x 100 mm',
  700.00,
  595.00,
  'disponível',
  0,
  false,
  'monitor-superframe-view-24-200hz',
  'Consultar garantia na loja',
  'https://img.terabyteshop.com.br/produto/g/monitor-gamer-superframe-view-24-pol-full-hd-fast-ips-1ms-200hz-99-srgb-freesync-hdmidp-sfvfb-24200-fhd-pro_230407.jpg',
  array['https://img.terabyteshop.com.br/produto/g/monitor-gamer-superframe-view-24-pol-full-hd-fast-ips-1ms-200hz-99-srgb-freesync-hdmidp-sfvfb-24200-fhd-pro_230407.jpg', 'https://img.terabyteshop.com.br/produto/g/monitor-gamer-superframe-view-24-pol-full-hd-fast-ips-1ms-200hz-99-srgb-freesync-hdmidp-sfvfb-24200-fhd-pro_230404.jpg', 'https://img.terabyteshop.com.br/produto/g/monitor-gamer-superframe-view-24-pol-full-hd-fast-ips-1ms-200hz-99-srgb-freesync-hdmidp-sfvfb-24200-fhd-pro_230405.jpg', 'https://img.terabyteshop.com.br/produto/g/monitor-gamer-superframe-view-24-pol-full-hd-fast-ips-1ms-200hz-99-srgb-freesync-hdmidp-sfvfb-24200-fhd-pro_230403.jpg', 'https://img.terabyteshop.com.br/produto/g/monitor-gamer-superframe-view-24-pol-full-hd-fast-ips-1ms-200hz-99-srgb-freesync-hdmidp-sfvfb-24200-fhd-pro_230406.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Monitor Gamer Mancer Horizon Z3B 23.8" Full HD 100Hz
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Monitor Gamer Mancer Horizon Z3B 23.8" Full HD 100Hz',
  'monitor-mancer-horizon-z3b-238',
  (select id from public.categories where slug = 'monitores' limit 1),
  'MZ',
  null,
  '23.8" Full HD, painel VA, 100Hz, 1ms, HDMI/VGA e Flicker Free.',
  'Monitor gamer Mancer Horizon Z3B de 23.8 polegadas com painel VA, resolução Full HD, taxa de atualização de 100Hz, tempo de resposta de 1ms e recursos de conforto visual para uso prolongado.

Especificações:
- Tela 23.8 polegadas VA
- Resolução Full HD 1920 x 1080
- Taxa de atualização 100Hz
- Tempo de resposta 1ms
- Brilho 250 cd/m²
- Contraste 3000:1
- Ângulo de visão 178° / 178°
- Blue Light Filter e Flicker Free
- 1x HDMI 1.4, 1x VGA e 1x DC
- VESA 75 x 75 mm',
  550.00,
  467.50,
  'disponível',
  0,
  false,
  'monitor-mancer-horizon-z3b-238',
  'Consultar garantia na loja',
  'https://mancer.com.br/wp-content/uploads/2022/12/mcr-hz3bn24-bl21265222112.jpg',
  array['https://mancer.com.br/wp-content/uploads/2022/12/mcr-hz3bn24-bl21265222112.jpg', 'https://mancer.com.br/wp-content/uploads/2025/12/MCR-HZ3BN24-BL2-1.jpg', 'https://mancer.com.br/wp-content/uploads/2025/12/MCR-HZ3BN24-BL2-2.jpg', 'https://mancer.com.br/wp-content/uploads/2025/12/MCR-HZ3BN24-BL2-3.jpg', 'https://mancer.com.br/wp-content/uploads/2025/12/MCR-HZ3BN24-BL2-4.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Monitor Gamer ilectry Vision 27" QHD 180Hz
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Monitor Gamer ilectry Vision 27" QHD 180Hz',
  'monitor-ilectry-vision-27-qhd-180hz',
  (select id from public.categories where slug = 'monitores' limit 1),
  'IV',
  null,
  '27" QHD, IPS, 180Hz, 1ms MPRT, HDR, FreeSync e G-Sync.',
  'Monitor gamer ilectry Vision 27 polegadas com resolução QHD, painel IPS, taxa de atualização de 180Hz, resposta de 1ms MPRT, HDR, FreeSync, compatibilidade G-Sync e áudio integrado.

Especificações:
- Tela 27 polegadas IPS
- Resolução QHD 2560 x 1440
- Taxa de atualização 180Hz
- Tempo de resposta 1ms MPRT
- Brilho máximo 350 cd/m²
- 90% DCI-P3
- HDR, AMD FreeSync e G-Sync
- Low Blue Light e Flicker Free
- 2x HDMI 2.0, 2x DisplayPort 1.4 e P2 3,5 mm
- Áudio integrado 2x3W
- VESA 100 x 100 mm',
  1000.00,
  850.00,
  'disponível',
  0,
  false,
  'monitor-ilectry-vision-27-qhd-180hz',
  'Consultar garantia na loja',
  'https://gamershop.pt/20086-large_default/ilectry-vision-2718-27--qhd-ips-1ms-180hz-monitor.jpg',
  array['https://gamershop.pt/20086-large_default/ilectry-vision-2718-27--qhd-ips-1ms-180hz-monitor.jpg', 'https://gamershop.pt/20087-large_default/ilectry-vision-2718-27--qhd-ips-1ms-180hz-monitor.jpg', 'https://gamershop.pt/20088-large_default/ilectry-vision-2718-27--qhd-ips-1ms-180hz-monitor.jpg', 'https://gamershop.pt/20089-large_default/ilectry-vision-2718-27--qhd-ips-1ms-180hz-monitor.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Monitor VX Pro 21.5" Full HD LED
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Monitor VX Pro 21.5" Full HD LED',
  'monitor-vx-pro-vx215x-215',
  (select id from public.categories where slug = 'monitores' limit 1),
  'VX',
  null,
  '21.5" Full HD, LED, HDMI/VGA, baixo consumo e VESA.',
  'Monitor VX Pro VX215X de 21.5 polegadas com resolução Full HD, painel LED/VA de alto contraste, entradas HDMI e VGA, design compacto e compatibilidade com suporte VESA para uso em trabalho, estudo e entretenimento.

Especificações:
- Tela 21.5 polegadas
- Resolução Full HD 1920 x 1080
- Painel LED / VA
- Formato 16:9 widescreen
- Brilho 250 cd/m²
- Contraste 3000:1
- 16,7 milhões de cores
- Tempo de resposta 8ms
- 1x HDMI e 1x VGA
- Consumo máximo até 20W
- VESA 75 x 75 mm',
  400.00,
  340.00,
  'disponível',
  0,
  false,
  'monitor-vx-pro-vx215x-215',
  'Consultar garantia na loja',
  'https://static.kadri.com.br/produto/multifotos/hd/109039-MAIN.png',
  array['https://static.kadri.com.br/produto/multifotos/hd/109039-MAIN.png', 'https://static.kadri.com.br/produto/multifotos/hd/20251014112642_3696996304_DMZ.jpg', 'https://static.kadri.com.br/produto/multifotos/hd/20251014112642_7538992462_DMZ.jpg', 'https://static.kadri.com.br/produto/multifotos/hd/20251014112642_8923991077_DMZ.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Teclado Gamer Mecânico AULA F3018 USB
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Teclado Gamer Mecânico AULA F3018 USB',
  'teclado-aula-f3018-mecanico',
  (select id from public.categories where slug = 'teclados' limit 1),
  'AULA',
  null,
  'Mecânico USB, 108 teclas, switch azul, LED RGB e anti-ghosting.',
  'Teclado gamer mecânico AULA F3018 com conexão USB, 108 teclas, switch azul, iluminação LED RGB, controles multimídia dedicados e N-key rollover anti-ghosting para maior precisão em jogos e digitação.

Especificações:
- Teclado mecânico gamer
- Conexão USB Plug & Play
- 108 teclas
- Switch azul
- Iluminação LED RGB
- N-key rollover anti-ghosting
- Controles multimídia dedicados
- Cabo de 1,6 m
- Vida útil de até 50 milhões de cliques
- Dimensões 438 x 136,9 x 32,6 mm
- Peso aproximado 761 g',
  300.00,
  255.00,
  'disponível',
  0,
  false,
  'teclado-aula-f3018-mecanico',
  'Consultar garantia na loja',
  'https://www.startech.com.bd/image/cache/catalog/keyboard/aula/f3018/f3018-01-500x500.webp',
  array['https://www.startech.com.bd/image/cache/catalog/keyboard/aula/f3018/f3018-01-500x500.webp', 'https://www.startech.com.bd/image/cache/catalog/keyboard/aula/f3018/f3018-02-500x500.webp']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Teclado Gamer 60% AULA WIN60 HE 8K Branco
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Teclado Gamer 60% AULA WIN60 HE 8K Branco',
  'teclado-aula-win60-he-8k-branco',
  (select id from public.categories where slug = 'teclados' limit 1),
  'WIN',
  null,
  '60%, switch magnético Hall Effect, RGB, USB-C e polling 8000Hz.',
  'Teclado gamer AULA WIN60 HE em formato 60%, com switches magnéticos Hall Effect, acionamento ajustável, modo Rapid Trigger, iluminação RGB personalizável e conexão USB-C com polling rate de 8000Hz para alta resposta em jogos competitivos.

Especificações:
- Layout compacto 60%
- Switch magnético Hall Effect
- Polling rate 8000Hz
- Rapid Trigger
- Acionamento ajustável de 0,1 a 4,0 mm
- Conexão USB-C com fio
- Iluminação RGB personalizável
- Switches hot-swappable magnéticos
- Padrão QWERTY
- Cor branca',
  350.00,
  297.50,
  'disponível',
  0,
  false,
  'teclado-aula-win60-he-8k-branco',
  'Consultar garantia na loja',
  'https://www.ultrapc.ma/52144-large_default/aula-win60-he-white-magnetic-switch.jpg',
  array['https://www.ultrapc.ma/52144-large_default/aula-win60-he-white-magnetic-switch.jpg', 'https://www.ultrapc.ma/52148-large_default/aula-win60-he-white-magnetic-switch.jpg', 'https://www.ultrapc.ma/52149-large_default/aula-win60-he-white-magnetic-switch.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Teclado Gamer Magnético Akko MonsGeek FUN60 Pro 8K Preto
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Teclado Gamer Magnético Akko MonsGeek FUN60 Pro 8K Preto',
  'teclado-akko-monsgeek-fun60-pro-8k-preto',
  (select id from public.categories where slug = 'teclados' limit 1),
  'F60',
  null,
  '60%, switch magnético Akko Glare Linear, RGB, USB-C e polling 8000Hz.',
  'Teclado gamer magnético Akko MonsGeek FUN60 Pro em acabamento preto, com layout compacto 60%, switches magnéticos Akko Glare Linear, polling rate de 8000Hz, iluminação RGB, conexão USB-C e estrutura em alumínio CNC. Modelo indicado para setups competitivos que precisam de resposta rápida, precisão e visual limpo.

Especificações:
- Layout compacto 60%
- Switch magnético Akko Glare Linear
- Acionamento magnético
- Polling rate 8000Hz
- Conexão USB Tipo-C
- Layout ANSI
- Iluminação RGB
- Hotswap DIY
- N-Key rollover
- Altura ajustável
- Estrutura em alumínio CNC
- Keycaps PBT Double-shot Side-printed Shine-through
- Cabo de 1,5 m
- Cor preta',
  350.00,
  297.50,
  'disponível',
  0,
  false,
  'teclado-akko-monsgeek-fun60-pro-8k-preto',
  'Consultar garantia na loja',
  'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1005386/xlarge/Teclado-Magnetico-Gamer-Monsgeek-Fun60-Pro-RGB-8k-Switch-Glare-Linear-Akko-Preto_1779310714.jpg',
  array['https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1005386/xlarge/Teclado-Magnetico-Gamer-Monsgeek-Fun60-Pro-RGB-8k-Switch-Glare-Linear-Akko-Preto_1779310714.jpg', 'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1005386/xlarge/Teclado-Magnetico-Gamer-Monsgeek-Fun60-Pro-RGB-8k-Switch-Glare-Linear-Akko-Preto_1779310716.jpg', 'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1005386/xlarge/Teclado-Magnetico-Gamer-Monsgeek-Fun60-Pro-RGB-8k-Switch-Glare-Linear-Akko-Preto_1779310717.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Teclado Mecânico Mancer Tharix Rainbow ABNT2
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Teclado Mecânico Mancer Tharix Rainbow ABNT2',
  'teclado-mancer-tharix-rainbow-abnt2-vermelho',
  (select id from public.categories where slug = 'teclados' limit 1),
  'THX',
  null,
  'Full size ABNT2, switch vermelho, Rainbow, USB e apoio para as mãos.',
  'Teclado mecânico gamer Mancer Tharix em padrão ABNT2, com formato completo, switches vermelhos, iluminação Rainbow com efeitos, apoio para as mãos e conexão USB Plug and Play. Uma opção prática para quem quer teclado mecânico com layout brasileiro, conforto e visual gamer.

Especificações:
- Teclado mecânico gamer
- Layout ABNT2 brasileiro
- Formato completo com 104 teclas
- Switch vermelho de fábrica
- Iluminação Rainbow com 9 efeitos
- 26 teclas anti-ghosting
- Conexão USB Plug and Play
- Compatível com PC e notebook
- Estrutura em metal + ABS
- Apoio para as mãos
- Cabo PVC de 1,5 m
- Compatível com Windows 11
- Peso aproximado 816 g
- Dimensões 443 x 205 x 40 mm
- Garantia de 12 meses',
  180.00,
  153.00,
  'disponível',
  0,
  false,
  'teclado-mancer-tharix-rainbow-abnt2-vermelho',
  'Consultar garantia na loja',
  'https://media.pichau.com.br/media/catalog/product/cache/2f958555330323e505eba7ce930bdf27/m/c/mcr-thx-rbw01445553.jpg',
  array['https://media.pichau.com.br/media/catalog/product/cache/2f958555330323e505eba7ce930bdf27/m/c/mcr-thx-rbw01445553.jpg', 'https://media.pichau.com.br/media/catalog/product/cache/2f958555330323e505eba7ce930bdf27/m/c/mcr-thx-rbw01445552.jpg', 'https://media.pichau.com.br/media/catalog/product/cache/2f958555330323e505eba7ce930bdf27/m/c/mcr-thx-rbw01445551.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Teclado Gamer TGT M60 A2 Rainbow ABNT2 Preto
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Teclado Gamer TGT M60 A2 Rainbow ABNT2 Preto',
  'teclado-tgt-m60-a2-rainbow-abnt2-preto',
  (select id from public.categories where slug = 'teclados' limit 1),
  'M60',
  null,
  'Full size ABNT2, 107 teclas, iluminação Rainbow e conexão USB.',
  'Teclado gamer TGT M60 A2 Rainbow em acabamento preto, com layout ABNT2 brasileiro, conjunto completo de 107 teclas, iluminação Rainbow e conexão USB Plug and Play. Uma opção acessível para setups gamer, estudo e uso diário, com teclas de membrana responsivas e visual iluminado.

Especificações:
- Teclado gamer de membrana
- Layout ABNT2 brasileiro
- Formato completo full size
- 107 teclas
- Iluminação Rainbow
- Conexão USB Plug and Play
- Cabo USB de 1,25 m
- Teclas com vida útil acima de 10 milhões de acionamentos
- Estrutura em plástico
- Voltagem de operação 4,5V a 5,5V
- Corrente de operação de até 200mA
- Dimensões 427 x 125 x 30 mm
- Peso aproximado 390 g
- Cor preta',
  80.00,
  68.00,
  'disponível',
  0,
  false,
  'teclado-tgt-m60-a2-rainbow-abnt2-preto',
  'Consultar garantia na loja',
  'https://media.pichau.com.br/media/catalog/product/cache/2f958555330323e505eba7ce930bdf27/t/g/tgt-m60a2-rbw01.jpg',
  array['https://media.pichau.com.br/media/catalog/product/cache/2f958555330323e505eba7ce930bdf27/t/g/tgt-m60a2-rbw01.jpg', 'https://media.pichau.com.br/media/catalog/product/cache/2f958555330323e505eba7ce930bdf27/t/g/tgt-m60a2-rbw012.jpg', 'https://media.pichau.com.br/media/catalog/product/cache/2f958555330323e505eba7ce930bdf27/t/g/tgt-m60a2-rbw013.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Mouse Gamer sem Fio Attack Shark X11 Tri-Mode
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Mouse Gamer sem Fio Attack Shark X11 Tri-Mode',
  'mouse-attack-shark-x11-tri-mode',
  (select id from public.categories where slug = 'mouses' limit 1),
  'X11',
  null,
  'Sem fio tri-mode, 22.000 DPI, sensor PAW3311, 63g e base magnética RGB.',
  'Mouse gamer Attack Shark X11 com conexão tri-mode, sensor óptico PixArt PAW3311 de até 22.000 DPI, design leve de 63g, base de carregamento magnética RGB e bateria de até 65 horas. Um modelo versátil para jogar sem fio, via Bluetooth ou com cabo USB-C.

Especificações:
- Sensor óptico PixArt PAW3311
- Até 22.000 DPI
- Conexão tri-mode: 2.4GHz, Bluetooth e USB-C
- Base de carregamento magnética RGB
- Peso aproximado 63g
- Bateria de até 65 horas
- Switches HUANO com vida útil de 20 milhões de cliques
- Scroll com encoder TTC
- 5 botões
- Compatível com Windows, macOS, Android e Xbox',
  220.00,
  187.00,
  'disponível',
  0,
  false,
  'mouse-attack-shark-x11-tri-mode',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 220.00, 187.00,
  0, 'mouse-attack-shark-x11-tri-mode-preto', 'https://images5.kabum.com.br/produtos/fotos/904345/mouse-gamer-sem-fio-attack-shark-x11-com-dock-black_1767892101_gg.jpg',
  array['https://images5.kabum.com.br/produtos/fotos/904345/mouse-gamer-sem-fio-attack-shark-x11-com-dock-black_1767892101_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/904345/mouse-gamer-sem-fio-attack-shark-x11-com-dock-black_1767892100_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/904345/mouse-gamer-sem-fio-attack-shark-x11-com-base-de-carregamento-magnetico-rgb-tri-mode-22-000-dpi-sensor-optico-paw3311-5-botoes-preto_1767968868_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/904345/mouse-gamer-sem-fio-attack-shark-x11-com-base-de-carregamento-magnetico-rgb-tri-mode-22-000-dpi-sensor-optico-paw3311-5-botoes-preto_1767968869_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/904345/mouse-gamer-sem-fio-attack-shark-x11-com-base-de-carregamento-magnetico-rgb-tri-mode-22-000-dpi-sensor-optico-paw3311-5-botoes-preto_1767968870_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/904345/mouse-gamer-sem-fio-attack-shark-x11-com-base-de-carregamento-magnetico-rgb-tri-mode-22-000-dpi-sensor-optico-paw3311-5-botoes-preto_1772574018_gg.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-attack-shark-x11-tri-mode'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-attack-shark-x11-tri-mode-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 220.00, 187.00,
  0, 'mouse-attack-shark-x11-tri-mode-branco', 'https://images6.kabum.com.br/produtos/fotos/904346/mouse-gamer-sem-fio-attack-shark-x11-com-dock-white_1767892900_gg.jpg',
  array['https://images6.kabum.com.br/produtos/fotos/904346/mouse-gamer-sem-fio-attack-shark-x11-com-dock-white_1767892900_gg.jpg', 'https://images6.kabum.com.br/produtos/fotos/904346/mouse-gamer-sem-fio-attack-shark-x11-com-dock-white_1767892899_gg.jpg', 'https://images6.kabum.com.br/produtos/fotos/904346/mouse-gamer-sem-fio-attack-shark-x11-com-dock-white_1767892898_gg.jpg', 'https://images6.kabum.com.br/produtos/fotos/904346/mouse-gamer-sem-fio-attack-shark-x11-com-dock-white_1767892897_gg.jpg', 'https://images6.kabum.com.br/produtos/fotos/904346/mouse-gamer-sem-fio-attack-shark-x11-com-base-de-carregamento-magnetico-rgb-tri-mode-22-000-dpi-sensor-optico-paw3311-5-botoes-branco_1767969040_gg.jpg', 'https://images6.kabum.com.br/produtos/fotos/904346/mouse-gamer-sem-fio-attack-shark-x11-com-base-de-carregamento-magnetico-rgb-tri-mode-22-000-dpi-sensor-optico-paw3311-5-botoes-branco_1767969041_gg.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-attack-shark-x11-tri-mode'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-attack-shark-x11-tri-mode-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Mouse Gamer Marvo Capo 20 M292 RGB
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Mouse Gamer Marvo Capo 20 M292 RGB',
  'mouse-marvo-capo-20-m292',
  (select id from public.categories where slug = 'mouses' limit 1),
  'M292',
  null,
  'Mouse gamer USB, 8000 DPI, RGB, 7 botões e cabo de 1,5 m.',
  'Mouse gamer Marvo Capo 20 M292 com conexão USB, sensor óptico de até 8000 DPI, iluminação RGB em 7 cores, 7 botões programáveis e cabo trançado de 1,5 m. Um modelo confortável para jogos e uso diário, com visual gamer e ajuste de sensibilidade.

Especificações:
- Sensor óptico
- Até 8000 DPI
- 7 botões programáveis
- Iluminação RGB em 7 cores
- Conexão USB
- Polling rate 125Hz
- Cabo trançado de 1,5 m
- Switches com vida útil de até 3 milhões de cliques
- Peso aproximado 78g
- Compatível com Windows 7 ou superior',
  120.00,
  102.00,
  'disponível',
  0,
  false,
  'mouse-marvo-capo-20-m292',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 120.00, 102.00,
  0, 'mouse-marvo-capo-20-m292-preto', 'https://dekada.com/imagemagic.php?h=600&img=images%2Fmarvo_m292_bk_01_FLzjT7.webp&page=prod_info&w=600',
  array['https://dekada.com/imagemagic.php?h=600&img=images%2Fmarvo_m292_bk_01_FLzjT7.webp&page=prod_info&w=600', 'https://dekada.com/images/marvo_m292_bk_01_FLzjT7.webp']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-marvo-capo-20-m292'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-marvo-capo-20-m292-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 120.00, 102.00,
  0, 'mouse-marvo-capo-20-m292-branco', 'https://www.targetcomponents.co.uk/productImages/80/MIMAR-M292-WH.jpg',
  array['https://www.targetcomponents.co.uk/productImages/80/MIMAR-M292-WH.jpg', 'https://www.targetcomponents.co.uk/productImages/80/207454.JPG', 'https://www.targetcomponents.co.uk/productImages/80/207455.JPG', 'https://www.targetcomponents.co.uk/productImages/80/207456.JPG']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-marvo-capo-20-m292'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-marvo-capo-20-m292-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Mouse Gamer Logitech G203 LIGHTSYNC RGB
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Mouse Gamer Logitech G203 LIGHTSYNC RGB',
  'mouse-logitech-g203-lightsync',
  (select id from public.categories where slug = 'mouses' limit 1),
  'G203',
  null,
  'RGB LIGHTSYNC, 6 botões programáveis, até 8.000 DPI e USB 1000Hz.',
  'Mouse gamer Logitech G203 LIGHTSYNC com sensor para jogos de até 8.000 DPI, iluminação RGB LIGHTSYNC personalizável, 6 botões programáveis, conexão USB com taxa de transmissão de 1000Hz/1ms e design clássico confortável para jogar e trabalhar.

Especificações:
- Sensor para jogos de 200 a 8.000 DPI
- Iluminação RGB LIGHTSYNC com 16,8 milhões de cores
- 6 botões programáveis
- Conexão USB
- Taxa de transmissão USB 1000Hz / 1ms
- Microprocessador ARM de 32 bits
- Cabo de 2,1 m
- Altura 116,6 mm
- Largura 62,15 mm
- Profundidade 38,2 mm
- Compatível com Windows 7 ou superior, macOS 10.10 ou superior e Chrome OS',
  150.00,
  127.50,
  'disponível',
  0,
  false,
  'mouse-logitech-g203-lightsync',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 150.00, 127.50,
  0, 'mouse-logitech-g203-lightsync-preto', 'https://images8.kabum.com.br/produtos/fotos/112948/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-preto-910-005793_1781792020_gg.jpg',
  array['https://images8.kabum.com.br/produtos/fotos/112948/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-preto-910-005793_1781792020_gg.jpg', 'https://images8.kabum.com.br/produtos/fotos/112948/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-preto-910-005793_1781792021_gg.jpg', 'https://images8.kabum.com.br/produtos/fotos/112948/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-preto-910-005793_1781792022_gg.jpg', 'https://images8.kabum.com.br/produtos/fotos/112948/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-preto-910-005793_1781792023_gg.jpg', 'https://images8.kabum.com.br/produtos/fotos/112948/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-preto-910-005793_1781792024_gg.jpg', 'https://images8.kabum.com.br/produtos/fotos/112948/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-preto-910-005793_1781792025_gg.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-logitech-g203-lightsync'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-logitech-g203-lightsync-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 150.00, 127.50,
  0, 'mouse-logitech-g203-lightsync-branco', 'https://images7.kabum.com.br/produtos/fotos/112947/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-branco-910-005794_1781794352_gg.jpg',
  array['https://images7.kabum.com.br/produtos/fotos/112947/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-branco-910-005794_1781794352_gg.jpg', 'https://images7.kabum.com.br/produtos/fotos/112947/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-branco-910-005794_1781794353_gg.jpg', 'https://images7.kabum.com.br/produtos/fotos/112947/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-branco-910-005794_1781794354_gg.jpg', 'https://images7.kabum.com.br/produtos/fotos/112947/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-branco-910-005794_1781794355_gg.jpg', 'https://images7.kabum.com.br/produtos/fotos/112947/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-branco-910-005794_1781794356_gg.jpg', 'https://images7.kabum.com.br/produtos/fotos/112947/mouse-gamer-logitech-g203-lightsync-rgb-efeito-de-ondas-de-cores-6-botoes-programaveis-e-ate-8-000-dpi-branco-910-005794_1781794357_gg.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-logitech-g203-lightsync'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-logitech-g203-lightsync-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Mouse Gamer sem Fio Logitech G305 LIGHTSPEED
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Mouse Gamer sem Fio Logitech G305 LIGHTSPEED',
  'mouse-logitech-g305-lightspeed',
  (select id from public.categories where slug = 'mouses' limit 1),
  'G305',
  null,
  'Sem fio LIGHTSPEED, sensor HERO 12K, 6 botões, 99g e até 250h de bateria.',
  'Mouse gamer sem fio Logitech G305 LIGHTSPEED com sensor HERO de até 12.000 DPI, conexão sem fio de 1ms, 6 botões programáveis, design leve de 99g e autonomia de até 250 horas com uma pilha AA. Um modelo portátil e preciso para jogar com liberdade.

Especificações:
- Sensor HERO de 200 a 12.000 DPI
- Tecnologia sem fio LIGHTSPEED
- Taxa de transmissão 1000Hz / 1ms
- 6 botões programáveis
- Peso aproximado 99g
- Até 250 horas de duração com uma pilha AA
- Velocidade máxima acima de 400 IPS
- Aceleração máxima acima de 40G
- Microprocessador ARM de 32 bits
- Receptor nano USB LIGHTSPEED
- Compatível com Windows 7 ou superior, macOS 10.11 ou superior e Chrome OS',
  260.00,
  221.00,
  'disponível',
  0,
  false,
  'mouse-logitech-g305-lightspeed',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 260.00, 221.00,
  0, 'mouse-logitech-g305-lightspeed-preto', 'https://images2.kabum.com.br/produtos/fotos/97092/mouse-gamer-sem-fio-logitech-g305-lightspeed-12000-dpi-6-botoes-preto-910-005281_1781726494_gg.jpg',
  array['https://images2.kabum.com.br/produtos/fotos/97092/mouse-gamer-sem-fio-logitech-g305-lightspeed-12000-dpi-6-botoes-preto-910-005281_1781726494_gg.jpg', 'https://images2.kabum.com.br/produtos/fotos/97092/mouse-gamer-sem-fio-logitech-g305-lightspeed-12000-dpi-6-botoes-preto-910-005281_1781726487_gg.jpg', 'https://images2.kabum.com.br/produtos/fotos/97092/mouse-gamer-sem-fio-logitech-g305-lightspeed-12000-dpi-6-botoes-preto-910-005281_1781726488_gg.jpg', 'https://images2.kabum.com.br/produtos/fotos/97092/mouse-gamer-sem-fio-logitech-g305-lightspeed-12000-dpi-6-botoes-preto-910-005281_1781726489_gg.jpg', 'https://images2.kabum.com.br/produtos/fotos/97092/mouse-gamer-sem-fio-logitech-g305-lightspeed-12000-dpi-6-botoes-preto-910-005281_1781726490_gg.jpg', 'https://images2.kabum.com.br/produtos/fotos/97092/mouse-gamer-sem-fio-logitech-g305-lightspeed-12000-dpi-6-botoes-preto-910-005281_1781726491_gg.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-logitech-g305-lightspeed'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-logitech-g305-lightspeed-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 260.00, 221.00,
  0, 'mouse-logitech-g305-lightspeed-branco', 'https://images8.kabum.com.br/produtos/fotos/269638/mouse-gamer-sem-fio-logitech-g305-lightspeed-12-000-dpi-6-botoes-programaveis-branco-910-005290_1781791483_gg.jpg',
  array['https://images8.kabum.com.br/produtos/fotos/269638/mouse-gamer-sem-fio-logitech-g305-lightspeed-12-000-dpi-6-botoes-programaveis-branco-910-005290_1781791483_gg.jpg', 'https://images8.kabum.com.br/produtos/fotos/269638/mouse-gamer-sem-fio-logitech-g305-lightspeed-12-000-dpi-6-botoes-programaveis-branco-910-005290_1781791484_gg.jpg', 'https://images8.kabum.com.br/produtos/fotos/269638/mouse-gamer-sem-fio-logitech-g305-lightspeed-12-000-dpi-6-botoes-programaveis-branco-910-005290_1781791485_gg.jpg', 'https://images8.kabum.com.br/produtos/fotos/269638/mouse-gamer-sem-fio-logitech-g305-lightspeed-12-000-dpi-6-botoes-programaveis-branco-910-005290_1781791486_gg.jpg', 'https://images8.kabum.com.br/produtos/fotos/269638/mouse-gamer-sem-fio-logitech-g305-lightspeed-12-000-dpi-6-botoes-programaveis-branco-910-005290_1781791487_gg.jpg', 'https://images8.kabum.com.br/produtos/fotos/269638/mouse-gamer-sem-fio-logitech-g305-lightspeed-12-000-dpi-6-botoes-programaveis-branco-910-005290_1781791488_gg.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-logitech-g305-lightspeed'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-logitech-g305-lightspeed-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Mouse Gamer Redragon Cobra M711 RGB
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Mouse Gamer Redragon Cobra M711 RGB',
  'mouse-redragon-cobra-m711',
  (select id from public.categories where slug = 'mouses' limit 1),
  'M711',
  null,
  'RGB Chroma, sensor PixArt, polling 1000Hz e botões programáveis.',
  'Mouse gamer Redragon Cobra M711 com iluminação RGB Chroma, sensor óptico PixArt, polling rate de até 1000Hz, botões programáveis, memória interna para perfis e cabo trançado. Um modelo ergonômico para jogos, macros e uso diário com visual gamer.

Especificações:
- Preto: sensor PixArt PMW3327 de até 12.400 DPI
- Branco: sensor PixArt PMW3325 de até 10.000 DPI
- Iluminação RGB Chroma
- Polling rate de até 1000Hz
- Botões programáveis
- Memória interna para perfis
- Software para macros, RGB e performance
- Cabo trançado
- USB 2.0 com fio
- Pés em teflon para melhor deslizamento
- Formato ergonômico para destros',
  150.00,
  127.50,
  'disponível',
  0,
  false,
  'mouse-redragon-cobra-m711',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 150.00, 127.50,
  0, 'mouse-redragon-cobra-m711-preto', 'https://images5.kabum.com.br/produtos/fotos/94555/mouse-gamer-redragon-cobra-chroma-rgb-10000dpi-7-botoes-preto-m711-v2_1742821619_gg.jpg',
  array['https://images5.kabum.com.br/produtos/fotos/94555/mouse-gamer-redragon-cobra-chroma-rgb-10000dpi-7-botoes-preto-m711-v2_1742821619_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/94555/mouse-gamer-redragon-cobra-chroma-rgb-10000dpi-7-botoes-preto-m711-v2_1742821620_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/94555/mouse-gamer-redragon-cobra-chroma-rgb-10000dpi-7-botoes-preto-m711-v2_1742821621_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/94555/mouse-gamer-redragon-cobra-chroma-rgb-10000dpi-7-botoes-preto-m711-v2_1742821622_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/94555/mouse-gamer-redragon-cobra-chroma-rgb-10000dpi-7-botoes-preto-m711-v2_1742821623_gg.jpg', 'https://images5.kabum.com.br/produtos/fotos/94555/mouse-gamer-redragon-cobra-chroma-rgb-10000dpi-7-botoes-preto-m711-v2_1742821624_gg.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-redragon-cobra-m711'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-redragon-cobra-m711-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 150.00, 127.50,
  0, 'mouse-redragon-cobra-m711-branco', 'https://static.kadri.com.br/produto/multifotos/hd/103164-MAIN.png',
  array['https://static.kadri.com.br/produto/multifotos/hd/103164-MAIN.png', 'https://static.kadri.com.br/produto/multifotos/hd/103164-3-MAIN.png', 'https://static.kadri.com.br/produto/multifotos/hd/103164-4-MAIN.png', 'https://static.kadri.com.br/produto/multifotos/hd/103164-5-MAIN.png']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-redragon-cobra-m711'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-redragon-cobra-m711-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Mouse Gamer sem Fio SmailWolf RS7 Tri-Mode
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Mouse Gamer sem Fio SmailWolf RS7 Tri-Mode',
  'mouse-smailwolf-rs7-tri-mode',
  (select id from public.categories where slug = 'mouses' limit 1),
  'RS7',
  null,
  'Tri-mode, sensor PAW3311, Bluetooth 5.1, 2.4G e USB-C.',
  'Mouse gamer sem fio SmailWolf RS7 com conexão tri-mode via Bluetooth 5.1, 2.4G e USB-C, sensor PAW3311 e design leve para jogos e produtividade. Uma opção versátil para quem quer alternar entre PC, notebook e outros dispositivos.

Especificações:
- Conexão tri-mode
- Bluetooth 5.1
- Wireless 2.4G
- USB-C com fio
- Sensor PAW3311
- Design leve para jogos
- Compatível com PC e notebook
- Indicado para jogos e produtividade',
  150.00,
  127.50,
  'disponível',
  0,
  false,
  'mouse-smailwolf-rs7-tri-mode',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 150.00, 127.50,
  0, 'mouse-smailwolf-rs7-tri-mode-preto', 'assets/rs7/rs7-preto-2.jpg',
  array['assets/rs7/rs7-preto-2.jpg', 'assets/rs7/rs7-preto-5.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-smailwolf-rs7-tri-mode'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-smailwolf-rs7-tri-mode-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 150.00, 127.50,
  0, 'mouse-smailwolf-rs7-tri-mode-branco', 'assets/rs7/rs7-branco-1.jpg',
  array['assets/rs7/rs7-branco-1.jpg', 'assets/rs7/rs7-branco-2.jpg', 'assets/rs7/rs7-branco-4.jpg', 'assets/rs7/rs7-branco-5.jpg', 'assets/rs7/rs7-preto-3.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'mouse-smailwolf-rs7-tri-mode'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'mouse-smailwolf-rs7-tri-mode-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Mouse Gamer MSI Forge GM300 RGB
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Mouse Gamer MSI Forge GM300 RGB',
  'mouse-msi-forge-gm300',
  (select id from public.categories where slug = 'mouses' limit 1),
  'MSI',
  null,
  'Preto, RGB, 7200 DPI, 7 botões, USB 2.0 e cabo de 1,5 m.',
  'Mouse gamer MSI Forge GM300 em acabamento preto, com sensor óptico de até 7200 DPI, iluminação RGB com 5 modos, 7 botões, conexão USB 2.0 e formato ergonômico com laterais texturizadas para conforto e controle.

Especificações:
- Sensor óptico
- DPI predefinido 1200 / 2400 / 4800 / 7200
- 7 botões
- Iluminação RGB com 5 modos
- Interface USB 2.0
- Microinterruptores com durabilidade de 10 milhões de cliques
- Cabo de 1,5 m
- Dimensões 127 x 70 x 41 mm
- Compatível com Windows 10 ou superior
- Cor preta',
  130.00,
  110.50,
  'disponível',
  0,
  false,
  'mouse-msi-forge-gm300',
  'Consultar garantia na loja',
  'https://images0.kabum.com.br/produtos/fotos/617460/mouse-gamer-msi-forge-gm300-rgb-7200-dpi-7-botoes-preto-s12-0402300-hh9_1730475290_gg.jpg',
  array['https://images0.kabum.com.br/produtos/fotos/617460/mouse-gamer-msi-forge-gm300-rgb-7200-dpi-7-botoes-preto-s12-0402300-hh9_1730475290_gg.jpg', 'https://images0.kabum.com.br/produtos/fotos/617460/mouse-gamer-msi-forge-gm300-rgb-7200-dpi-7-botoes-preto-s12-0402300-hh9_1730475291_gg.jpg', 'https://images0.kabum.com.br/produtos/fotos/617460/mouse-gamer-msi-forge-gm300-rgb-7200-dpi-7-botoes-preto-s12-0402300-hh9_1730475292_gg.jpg', 'https://images0.kabum.com.br/produtos/fotos/617460/mouse-gamer-msi-forge-gm300-rgb-7200-dpi-7-botoes-preto-s12-0402300-hh9_1730475293_gg.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Mouse Gamer MSI Versa 300 Wireless RGB
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Mouse Gamer MSI Versa 300 Wireless RGB',
  'mouse-msi-versa-300-wireless',
  (select id from public.categories where slug = 'mouses' limit 1),
  'MSI',
  null,
  'Sem fio, RGB, 8000 DPI, 6 botões, 60g, Bluetooth 5.3 e 2.4GHz.',
  'Mouse gamer MSI Versa 300 Wireless em acabamento preto, com sensor óptico PixArt PAW3104DB de até 8000 DPI, conexão MSI SWIFTSPEED 2.4GHz, Bluetooth 5.3 e USB 2.0, resposta de 1000Hz/1ms, RGB e bateria de até 50 horas.

Especificações:
- Sensor óptico PixArt PAW3104DB
- DPI ajustável de 400 a 8000
- Conexão 2.4GHz Wireless MSI SWIFTSPEED
- Bluetooth 5.3
- USB 2.0
- Resposta 1000Hz / 1ms
- 6 botões
- Iluminação RGB
- Peso aproximado 60g
- Bateria de até 50 horas
- Switches Kailh Micro com durabilidade de 30 milhões de cliques
- Cabo USB-C para USB-A de 2 m
- Dimensões 125 x 64 x 41 mm
- Compatível com Windows 10 ou superior
- Cor preta',
  180.00,
  153.00,
  'disponível',
  0,
  false,
  'mouse-msi-versa-300-wireless',
  'Consultar garantia na loja',
  'https://images9.kabum.com.br/produtos/fotos/721799/mouse-gamer-msi-versa-300-wireless-rgb-8000-dpi-6-botoes-preto-versa300w_1747226775_gg.jpg',
  array['https://images9.kabum.com.br/produtos/fotos/721799/mouse-gamer-msi-versa-300-wireless-rgb-8000-dpi-6-botoes-preto-versa300w_1747226775_gg.jpg', 'https://images9.kabum.com.br/produtos/fotos/721799/mouse-gamer-msi-versa-300-wireless-rgb-8000-dpi-6-botoes-preto-versa300w_1747226774_gg.jpg', 'https://images9.kabum.com.br/produtos/fotos/721799/mouse-gamer-msi-versa-300-wireless-rgb-8000-dpi-6-botoes-preto-versa300w_1747226768_gg.jpg', 'https://images9.kabum.com.br/produtos/fotos/721799/mouse-gamer-msi-versa-300-wireless-rgb-8000-dpi-6-botoes-preto-versa300w_1747226769_gg.jpg', 'https://images9.kabum.com.br/produtos/fotos/721799/mouse-gamer-msi-versa-300-wireless-rgb-8000-dpi-6-botoes-preto-versa300w_1747226770_gg.jpg', 'https://images9.kabum.com.br/produtos/fotos/721799/mouse-gamer-msi-versa-300-wireless-rgb-8000-dpi-6-botoes-preto-versa300w_1747226771_gg.jpg', 'https://images9.kabum.com.br/produtos/fotos/721799/mouse-gamer-msi-versa-300-wireless-rgb-8000-dpi-6-botoes-preto-versa300w_1747226773_gg.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Mouse Óptico Sem Fio AOC Office M400B
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Mouse Óptico Sem Fio AOC Office M400B',
  'mouse-aoc-office-m400b',
  (select id from public.categories where slug = 'mouses' limit 1),
  'AOC',
  null,
  'Sem fio 2.4GHz, 1600 DPI, 4 botões, preto e plug-and-play.',
  'Mouse óptico sem fio AOC Office M400B em acabamento preto, com conexão 2.4GHz, DPI ajustável em 800, 1200 e 1600, alcance de operação de até 10 metros, formato ergonômico e instalação plug-and-play para uso diário no escritório, estudo ou notebook.

Especificações:
- Sensor óptico
- DPI ajustável em 800, 1200 e 1600
- Conexão sem fio 2.4GHz
- Alcance de operação de 8 a 10 metros
- 4 botões
- Vida útil do switch de 3 milhões de cliques
- Instalação plug-and-play
- Peso aproximado 43 g
- Dimensões 107 x 64 x 38 mm
- Alimentação por 1 pilha AA, não inclusa
- Compatível com Windows e Linux
- Cor preta',
  80.00,
  68.00,
  'disponível',
  0,
  false,
  'mouse-aoc-office-m400b',
  'Consultar garantia na loja',
  'https://images2.kabum.com.br/produtos/fotos/sync_mirakl/908722/xlarge/Mouse-Optico-Sem-Fio-Aoc-2-4ghz-Office-Preto-1600dpi-M400b_1770930710.jpg',
  array['https://images2.kabum.com.br/produtos/fotos/sync_mirakl/908722/xlarge/Mouse-Optico-Sem-Fio-Aoc-2-4ghz-Office-Preto-1600dpi-M400b_1770930710.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Headset Gamer Mchose V9 Turbo
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Headset Gamer Mchose V9 Turbo',
  'headset-mchose-v9-turbo',
  (select id from public.categories where slug = 'headsets' limit 1),
  'V9',
  null,
  'Sem fio, base magnética RGB, 7.1 virtual, até 200h de bateria e microfone removível.',
  'Headset gamer Mchose V9 Turbo com base magnética RGB, conexão 2.4GHz, Bluetooth, USB-C wireless e cabo, drivers de 60mm, áudio surround virtual 7.1, latência de 15ms no modo 2.4GHz, microfone omnidirecional removível com cancelamento de ruído por IA e autonomia de até 200 horas.

Especificações:
- Drivers de 60mm
- Áudio surround virtual 7.1
- Resposta de frequência do fone de 20Hz a 28.000Hz
- Impedância de 32 Ohms
- Microfone omnidirecional removível
- Cancelamento de ruído por IA
- Conexão 2.4GHz, Bluetooth, USB-C wireless e cabo
- Latência de 15ms no modo 2.4GHz
- Alcance sem fio de até 40m via Bluetooth e 15m em 2.4GHz
- Bateria de 2000mAh com autonomia de até 200 horas
- Base magnética RGB inclusa
- Almofadas em couro proteico ice-cool com espuma de memória
- Arco em alumínio ultraleve com 10 níveis de ajuste
- Conchas com rotação de 90 graus
- Peso aproximado de 320g sem microfone
- Compatível com PC, notebook, PS5, PS4, Nintendo Switch, celular e tablet',
  1000.00,
  850.00,
  'disponível',
  0,
  false,
  'headset-mchose-v9-turbo',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 1000.00, 850.00,
  0, 'headset-mchose-v9-turbo-preto', 'https://images9.kabum.com.br/produtos/fotos/sync_mirakl/1054339/xlarge/Headset-Mchose-V9-Turbo-Gamer-Base-Magn-tica-RGB-Sem-Fio_1783015123.jpg',
  array['https://images9.kabum.com.br/produtos/fotos/sync_mirakl/1054339/xlarge/Headset-Mchose-V9-Turbo-Gamer-Base-Magn-tica-RGB-Sem-Fio_1783015123.jpg', 'https://images9.kabum.com.br/produtos/fotos/sync_mirakl/1054339/xlarge/Headset-Mchose-V9-Turbo-Gamer-Base-Magn-tica-RGB-Sem-Fio_1783015125.jpg', 'https://images9.kabum.com.br/produtos/fotos/sync_mirakl/1054339/xlarge/Headset-Mchose-V9-Turbo-Gamer-Base-Magn-tica-RGB-Sem-Fio_1783015126.jpg', 'https://images9.kabum.com.br/produtos/fotos/sync_mirakl/1054339/xlarge/Headset-Mchose-V9-Turbo-Gamer-Base-Magn-tica-RGB-Sem-Fio_1783015127.jpg', 'https://images9.kabum.com.br/produtos/fotos/sync_mirakl/1054339/xlarge/Headset-Mchose-V9-Turbo-Gamer-Base-Magn-tica-RGB-Sem-Fio_1783015128.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'headset-mchose-v9-turbo'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'headset-mchose-v9-turbo-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 1000.00, 850.00,
  0, 'headset-mchose-v9-turbo-branco', 'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1054336/xlarge/Headset-Gamer-Mchose-V9-Turbo-2-4ghz-Bluetooth-40m-Alcance_1783015122.jpg',
  array['https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1054336/xlarge/Headset-Gamer-Mchose-V9-Turbo-2-4ghz-Bluetooth-40m-Alcance_1783015122.jpg', 'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1054336/xlarge/Headset-Gamer-Mchose-V9-Turbo-2-4ghz-Bluetooth-40m-Alcance_1783015123.jpg', 'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1054336/xlarge/Headset-Gamer-Mchose-V9-Turbo-2-4ghz-Bluetooth-40m-Alcance_1783015124.jpg', 'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1054336/xlarge/Headset-Gamer-Mchose-V9-Turbo-2-4ghz-Bluetooth-40m-Alcance_1783015125.jpg', 'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1054336/xlarge/Headset-Gamer-Mchose-V9-Turbo-2-4ghz-Bluetooth-40m-Alcance_1783015126.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'headset-mchose-v9-turbo'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'headset-mchose-v9-turbo-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Headset Gamer Mchose V9 Pro
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Headset Gamer Mchose V9 Pro',
  'headset-mchose-v9-pro',
  (select id from public.categories where slug = 'headsets' limit 1),
  'V9 Pro',
  null,
  'Tri-mode, 7.1 surround, latência de 15ms, microfone com IA, 265g e até 250h.',
  'Headset gamer Mchose V9 Pro com som posicional 7.1, baixa latência de 15ms, microfone com IA, conexão tri-mode, autonomia de até 250 horas e construção leve de 265g. Uma opção competitiva para FPS, jogos online e uso diário sem fio.

Especificações:
- Som posicional 7.1 surround
- Latência de 15ms
- Microfone com IA
- Conexão tri-mode
- Autonomia de até 250 horas
- Peso aproximado de 265g
- Indicado para FPS, jogos online e entretenimento
- Disponível nas cores preta e branca',
  500.00,
  425.00,
  'disponível',
  0,
  false,
  'headset-mchose-v9-pro',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 500.00, 425.00,
  0, 'headset-mchose-v9-pro-preto', 'assets/v9-pro/v9-pro-preto.jpg',
  array['assets/v9-pro/v9-pro-preto.jpg', 'assets/v9-pro/v9-pro-preto-tera-1.jpg', 'assets/v9-pro/v9-pro-preto-tera-2.jpg', 'assets/v9-pro/v9-pro-preto-tera-3.jpg', 'assets/v9-pro/v9-pro-preto-tera-4.jpg', 'assets/v9-pro/v9-pro-preto-tera-5.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'headset-mchose-v9-pro'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'headset-mchose-v9-pro-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 500.00, 425.00,
  0, 'headset-mchose-v9-pro-branco', 'assets/v9-pro/v9-pro-branco-waz-1.jpg',
  array['assets/v9-pro/v9-pro-branco-waz-1.jpg', 'assets/v9-pro/v9-pro-branco-waz-2.jpg', 'assets/v9-pro/v9-pro-branco-waz-3.jpg', 'assets/v9-pro/v9-pro-branco-waz-4.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'headset-mchose-v9-pro'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'headset-mchose-v9-pro-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Headset Gamer Mchose X9
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Headset Gamer Mchose X9',
  'headset-mchose-x9',
  (select id from public.categories where slug = 'headsets' limit 1),
  'X9',
  null,
  'Sem fio, Bluetooth, 2.4G, multi-modo, redução de ruído e bateria de longa duração.',
  'Headset gamer Mchose X9 sem fio, feito para jogos e entretenimento, com conectividade multi-modo, Bluetooth, 2.4G, redução de ruído e bateria de longa duração. Uma opção versátil para setup gamer, computador e uso diário.

Especificações:
- Headset gamer sem fio
- Conectividade multi-modo
- Bluetooth
- Conexão 2.4G
- Redução de ruído
- Bateria de longa duração
- Indicado para jogos e entretenimento
- Compatível com computador e setup gamer
- Disponível nas cores preta e branca',
  650.00,
  552.50,
  'disponível',
  0,
  false,
  'headset-mchose-x9',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 650.00, 552.50,
  0, 'headset-mchose-x9-preto', 'assets/x9/x9-preto-keydom.png',
  array['assets/x9/x9-preto-keydom.png']::text[], true, 'ativo'
from public.products p where p.slug = 'headset-mchose-x9'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'headset-mchose-x9-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 650.00, 552.50,
  0, 'headset-mchose-x9-branco', 'assets/x9/x9-branco-keydom.png',
  array['assets/x9/x9-branco-keydom.png']::text[], true, 'ativo'
from public.products p where p.slug = 'headset-mchose-x9'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'headset-mchose-x9-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Headset Gamer Mancer Twilight Rainbow
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Headset Gamer Mancer Twilight Rainbow',
  'headset-mancer-twilight-rainbow',
  (select id from public.categories where slug = 'headsets' limit 1),
  'MCR',
  null,
  'Preto, iluminação Rainbow, drivers de 50mm, microfone omnidirecional e conexão USB + P2.',
  'Headset gamer Mancer Twilight em acabamento preto, com iluminação Rainbow nos earcups, arco estofado ajustável, earpads confortáveis em couro, drivers de 50mm e controle de volume no earcup esquerdo. Um modelo prático para jogos, chamadas e uso diário.

Especificações:
- Drivers de 50mm
- Frequência de resposta de 20Hz a 20KHz
- Sensibilidade de 112 ± 3dB
- Microfone omnidirecional ajustável
- Sensibilidade do microfone de 38 ± 3dB
- Microfone de 10 cm
- Iluminação Rainbow
- Estrutura em ABS
- Earpads confortáveis em couro
- Controle de volume no earcup esquerdo
- Conectores USB e 2 x 3.5 mm mini jack
- Cabo PVC de 2 m
- Conteúdo: headset e manual
- Garantia de 12 meses
- Cor preta',
  120.00,
  102.00,
  'disponível',
  0,
  false,
  'headset-mancer-twilight-rainbow',
  'Consultar garantia na loja',
  'assets/mancer-twilight/mancer-twilight-1.jpg',
  array['assets/mancer-twilight/mancer-twilight-1.jpg', 'assets/mancer-twilight/mancer-twilight-2.jpg', 'assets/mancer-twilight/mancer-twilight-3.jpg', 'assets/mancer-twilight/mancer-twilight-4.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Headset Redragon Zeus X H510 RGB
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Headset Redragon Zeus X H510 RGB',
  'headset-redragon-zeus-x-h510',
  (select id from public.categories where slug = 'headsets' limit 1),
  'H510',
  null,
  'Som Surround 7.1 virtual, drivers de 53mm, RGB, microfone com redução de ruído e conexão USB.',
  'Headset gamer Redragon Zeus X H510 RGB com som estéreo e Surround 7.1 virtual, drivers de 53mm, iluminação RGB Chroma Mk.II, microfone com redução de ruído, almofadas confortáveis e controladora integrada para ajustes rápidos durante o uso.

Especificações:
- Drivers de 53mm
- Som estéreo e Surround 7.1 virtual
- Iluminação RGB Redragon Chroma Mk.II com 4 efeitos
- Microfone com redução de ruído
- Controladora integrada no cabo
- Função mute integrada
- Compatível com software para equalização e ajustes
- Conexão USB 2.0
- Frequência de resposta de 50Hz a 20.000Hz
- Sensibilidade de 98 ± 3dB
- Impedância de 64 Ohms ± 10%
- Earpads em tecido de malha esportiva
- Hastes ajustáveis de metal
- Cabo de 1,8 m
- Disponível nas cores preta e branco/rose',
  350.00,
  297.50,
  'disponível',
  0,
  false,
  'headset-redragon-zeus-x-h510',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 350.00, 297.50,
  0, 'headset-redragon-zeus-x-h510-preto', 'assets/redragon-zeus-x/zeus-x-preto-1.jpg',
  array['assets/redragon-zeus-x/zeus-x-preto-1.jpg', 'assets/redragon-zeus-x/zeus-x-preto-2.jpg', 'assets/redragon-zeus-x/zeus-x-preto-3.jpg', 'assets/redragon-zeus-x/zeus-x-preto-4.jpg', 'assets/redragon-zeus-x/zeus-x-preto-5.jpg', 'assets/redragon-zeus-x/zeus-x-preto-6.jpg', 'assets/redragon-zeus-x/zeus-x-preto-7.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'headset-redragon-zeus-x-h510'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'headset-redragon-zeus-x-h510-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco/Rose', 'Branco/Rose',
  'Branco/Rose', 400.00, 340.00,
  0, 'headset-redragon-zeus-x-h510-branco-rose', 'assets/redragon-zeus-x/zeus-x-branco-1.jpg',
  array['assets/redragon-zeus-x/zeus-x-branco-1.jpg', 'assets/redragon-zeus-x/zeus-x-branco-2.jpg', 'assets/redragon-zeus-x/zeus-x-branco-3.jpg', 'assets/redragon-zeus-x/zeus-x-branco-4.jpg', 'assets/redragon-zeus-x/zeus-x-branco-5.jpg', 'assets/redragon-zeus-x/zeus-x-branco-6.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'headset-redragon-zeus-x-h510'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'headset-redragon-zeus-x-h510-branco-rose'
    and coalesce(existing.name, '') = 'Branco/Rose'
    and coalesce(existing.color, '') = 'Branco/Rose'
);

-- Produto: Headset Redragon Zeus Pro H510 Pro
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Headset Redragon Zeus Pro H510 Pro',
  'headset-redragon-zeus-pro-h510-pro',
  (select id from public.categories where slug = 'headsets' limit 1),
  'H510 Pro',
  null,
  'Sem fio, 7.1 virtual, drivers de 53mm, Bluetooth, conexão 2.4GHz/USB e bateria de até 18h.',
  'Headset gamer sem fio Redragon Zeus Pro H510 Pro em acabamento preto, com drivers de 53mm, som Surround 7.1 virtual, conexão 2.4GHz, Bluetooth e USB, alcance aproximado de 10 metros e bateria de até 18 horas. Um modelo versátil para jogar com liberdade e conforto.

Especificações:
- Drivers de 53mm
- Som Surround 7.1 virtual
- Conexões 2.4GHz, Bluetooth e USB
- Alcance aproximado de 10 metros
- Bateria de aproximadamente 18 horas
- Tempo de carregamento de aproximadamente 3 horas
- Capacidade da bateria de 750mAh
- Frequência de resposta de 20Hz a 20KHz
- Sensibilidade de 111 ± 3dB
- Impedância de áudio de 17 ± 15 Ohms
- Microfone omnidirecional
- Sensibilidade do microfone de -42 ± 3dB
- Earpads em tecido
- Compatível com Windows XP, Vista, 7, 8, 10 e 11
- Cor preta',
  400.00,
  340.00,
  'disponível',
  0,
  false,
  'headset-redragon-zeus-pro-h510-pro',
  'Consultar garantia na loja',
  'assets/redragon-zeus-pro/zeus-pro-1.jpg',
  array['assets/redragon-zeus-pro/zeus-pro-1.jpg', 'assets/redragon-zeus-pro/zeus-pro-2.jpg', 'assets/redragon-zeus-pro/zeus-pro-3.jpg', 'assets/redragon-zeus-pro/zeus-pro-4.jpg', 'assets/redragon-zeus-pro/zeus-pro-5.jpg', 'assets/redragon-zeus-pro/zeus-pro-6.jpg', 'assets/redragon-zeus-pro/zeus-pro-7.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Headset Redragon Zeus Lite H510-LT
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Headset Redragon Zeus Lite H510-LT',
  'headset-redragon-zeus-lite-h510-lt',
  (select id from public.categories where slug = 'headsets' limit 1),
  'H510 LT',
  null,
  'P3 3.5mm, drivers de 53mm, microfone removível, earpads em tecido e compatível com PC, PS5 e Xbox.',
  'Headset gamer Redragon Zeus Lite H510-LT em acabamento preto, com conexão P3 3.5mm, drivers de 53mm, microfone removível com redução de ruído, controle inline para ajuste e mute, earpads em tecido de malha esportiva e cabo de 1,8 metro.

Especificações:
- Drivers de 53mm
- Conexão P3 3.5mm
- Compatível com PC, PS5 e Xbox
- Microfone removível
- Microfone omnidirecional com redução de ruído
- Função de silenciar integrada no controle inline
- Earpads em tecido de malha esportiva
- Frequência de resposta de 20Hz a 20KHz
- Sensibilidade de 110 ± 3dB
- Impedância de 64 Ohms ± 15%
- Potência nominal de 20mW
- Sensibilidade do microfone de -42 ± 2dB
- Cabo de 1,8 m
- Garantia de 1 ano pelo fabricante
- Cor preta',
  250.00,
  212.50,
  'disponível',
  0,
  false,
  'headset-redragon-zeus-lite-h510-lt',
  'Consultar garantia na loja',
  'assets/redragon-zeus-lite/zeus-lite-1.jpg',
  array['assets/redragon-zeus-lite/zeus-lite-1.jpg', 'assets/redragon-zeus-lite/zeus-lite-2.jpg', 'assets/redragon-zeus-lite/zeus-lite-3.jpg', 'assets/redragon-zeus-lite/zeus-lite-4.jpg', 'assets/redragon-zeus-lite/zeus-lite-5.jpg', 'assets/redragon-zeus-lite/zeus-lite-6.jpg', 'assets/redragon-zeus-lite/zeus-lite-7.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Headset Marvo Tactic 20 / Tactic 40
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Headset Marvo Tactic 20 / Tactic 40',
  'headset-marvo-tactic-20-40',
  (select id from public.categories where slug = 'headsets' limit 1),
  'Marvo',
  null,
  'Opções Tactic 20 preto e Tactic 40 rosa, drivers de 50mm, RGB e microfone para jogos.',
  'Headset gamer Marvo com opções Tactic 20 preto e Tactic 40 rosa, ambos com visual gamer, drivers de 50mm, iluminação RGB e microfone para comunicação em jogos, chamadas e uso diário no setup.

Especificações:
- Drivers de 50mm
- Iluminação RGB
- Microfone para comunicação em jogos e chamadas
- Tactic 20 preto com conectores 3.5mm + USB 2.0
- Tactic 20 preto com frequência de 20Hz a 20KHz
- Tactic 20 preto com sensibilidade de 112 ± 3dB
- Tactic 20 preto com cabo de 1,8 m
- Tactic 40 rosa com cabo trançado de 2 m
- Tactic 40 rosa com almofadas em tecido
- Tactic 40 rosa com microfone omnidirecional
- Tactic 40 rosa com sensibilidade de 114 ± 3dB
- Tactic 40 rosa com frequência de 30Hz a 15KHz
- Indicado para setup gamer, PC e uso diário
- Disponível nas opções Tactic 20 preto e Tactic 40 rosa',
  150.00,
  127.50,
  'disponível',
  0,
  false,
  'headset-marvo-tactic-20-40',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Tactic 20 Preto', 'Tactic 20 Preto',
  'Tactic 20 Preto', 150.00, 127.50,
  0, 'headset-marvo-tactic-20-40-tactic-20-preto', 'assets/marvo-tactic-20/tactic-20-preto-1.png',
  array['assets/marvo-tactic-20/tactic-20-preto-1.png', 'assets/marvo-tactic-20/tactic-20-preto-2.png', 'assets/marvo-tactic-20/tactic-20-preto-3.png', 'assets/marvo-tactic-20/tactic-20-preto-4.png', 'assets/marvo-tactic-20/tactic-20-preto-5.png', 'assets/marvo-tactic-20/tactic-20-preto-6.png']::text[], true, 'ativo'
from public.products p where p.slug = 'headset-marvo-tactic-20-40'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'headset-marvo-tactic-20-40-tactic-20-preto'
    and coalesce(existing.name, '') = 'Tactic 20 Preto'
    and coalesce(existing.color, '') = 'Tactic 20 Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Tactic 40 Rosa', 'Tactic 40 Rosa',
  'Tactic 40 Rosa', 150.00, 127.50,
  0, 'headset-marvo-tactic-20-40-tactic-40-rosa', 'assets/marvo-tactic-20/tactic-40-rosa-1.jpg',
  array['assets/marvo-tactic-20/tactic-40-rosa-1.jpg', 'assets/marvo-tactic-20/tactic-40-rosa-2.jpg', 'assets/marvo-tactic-20/tactic-40-rosa-3.jpg', 'assets/marvo-tactic-20/tactic-40-rosa-4.jpg', 'assets/marvo-tactic-20/tactic-40-rosa-5.jpg', 'assets/marvo-tactic-20/tactic-40-rosa-6.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'headset-marvo-tactic-20-40'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'headset-marvo-tactic-20-40-tactic-40-rosa'
    and coalesce(existing.name, '') = 'Tactic 40 Rosa'
    and coalesce(existing.color, '') = 'Tactic 40 Rosa'
);

-- Produto: Headset Havit H2002d Red
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Headset Havit H2002d Red',
  'headset-havit-h2002d-red',
  (select id from public.categories where slug = 'headsets' limit 1),
  'H2002d',
  null,
  'Vermelho e branco, drivers de 53mm, microfone destacável, plug 3.5mm e compatível com Xbox One e PS4.',
  'Headset gamer Havit H2002d Red em acabamento vermelho e branco, com drivers de 53mm, microfone destacável, plug 3.5mm e adaptador P3 para 2 x P2. Um modelo confortável para jogos, chamadas e uso diário, com som potente e design ergonômico.

Especificações:
- Drivers de 53mm
- Plug 3.5mm
- Microfone destacável
- Adaptador P3 para 2 x P2 incluso
- Impedância de 64 ± 15% Ohms
- Sensibilidade de 110 ± 3dB
- Resposta de frequência de 20Hz a 20KHz
- Microfone de 6.0 x 2.2mm
- Cabo de 1,7 m
- Compatível com Xbox One e PS4
- Headband ajustável com design ergonômico
- Conteúdo: headphone H2002d, microfone destacável e adaptador
- Garantia de 1 ano
- Cor vermelho e branco',
  250.00,
  212.50,
  'disponível',
  0,
  false,
  'headset-havit-h2002d-red',
  'Consultar garantia na loja',
  'assets/havit-h2002d-red/havit-h2002d-red-1.jpg',
  array['assets/havit-h2002d-red/havit-h2002d-red-1.jpg', 'assets/havit-h2002d-red/havit-h2002d-red-2.jpg', 'assets/havit-h2002d-red/havit-h2002d-red-3.jpg', 'assets/havit-h2002d-red/havit-h2002d-red-4.jpg', 'assets/havit-h2002d-red/havit-h2002d-red-5.jpg', 'assets/havit-h2002d-red/havit-h2002d-red-6.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Gabinete Gamer Mancer CV700L
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Gabinete Gamer Mancer CV700L',
  'gabinete-mancer-cv700l-preto',
  (select id from public.categories where slug = 'gabinetes' limit 1),
  'CV700L',
  null,
  'Mid Tower preto, lateral e frontal em vidro temperado, suporte M-ITX/M-ATX e placa de vídeo até 420mm.',
  'Gabinete Gamer Mancer CV700L preto com visual limpo, lateral e frontal em vidro temperado removíveis, estrutura em aço SPCC, ótimo espaço interno e lateral vazada para melhorar a circulação de ar. Uma opção moderna para montar setups gamers compactos e bem apresentados.

Especificações:
- Formato Mid Tower
- Lateral e frontal em vidro temperado removíveis
- Estrutura em aço SPCC 0.5mm
- Suporte para placas-mãe M-ITX e M-ATX
- Suporte para placa de vídeo de até 420mm
- Altura máxima do cooler do processador de 160mm
- Suporte para até 9 ventoinhas de 120mm
- Water cooler superior de até 360mm
- Water cooler lateral de até 240mm
- Water cooler traseiro de 120mm
- Suporte de armazenamento: 2x HDD 3.5 polegadas e 3x SSD 2.5 polegadas
- 5 slots de expansão
- Entradas: 1x USB 3.0, 2x USB 2.0 e áudio HD
- Dimensões: 277 x 443 x 355 mm
- Cor preta',
  310.00,
  255.00,
  'disponível',
  0,
  false,
  'gabinete-mancer-cv700l-preto',
  'Consultar garantia na loja',
  'assets/mancer-cv700l/mancer-cv700l-1.jpg',
  array['assets/mancer-cv700l/mancer-cv700l-1.jpg', 'assets/mancer-cv700l/mancer-cv700l-2.jpg', 'assets/mancer-cv700l/mancer-cv700l-3.jpg', 'assets/mancer-cv700l/mancer-cv700l-4.jpg', 'assets/mancer-cv700l/mancer-cv700l-5.jpg', 'assets/mancer-cv700l/mancer-cv700l-6.jpg', 'assets/mancer-cv700l/mancer-cv700l-7.jpg', 'assets/mancer-cv700l/mancer-cv700l-8.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Gabinete Gamer Mancer CV100
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Gabinete Gamer Mancer CV100',
  'gabinete-mancer-cv100',
  (select id from public.categories where slug = 'gabinetes' limit 1),
  'CV100',
  null,
  'Mid Tower com lateral e frontal em vidro temperado, suporte M-ITX/M-ATX e opções preto ou branco.',
  'Gabinete Gamer Mancer CV100 da linha Clear Vision, com lateral e frontal em vidro temperado, lateral vazada para melhor circulação de ar, estrutura em aço SPCC e espaço interno para montar setups gamers compactos e bem apresentados.

Especificações:
- Formato Mid Tower
- Lateral e frontal em vidro temperado
- Estrutura em aço SPCC 0.5mm
- Vidro temperado de 3mm
- Suporte para placas-mãe M-ITX e M-ATX
- Suporte para placa de vídeo de até 320mm
- Altura máxima do cooler do processador de 160mm
- Suporte para até 7 ventoinhas de 120mm
- Water cooler superior de até 240mm
- Water cooler traseiro de 120mm
- Baias: 1x HDD 3.5 polegadas e 2x SSD 2.5 polegadas
- 4 slots de expansão
- Entradas: 1x USB 3.0, 2x USB 2.0 e áudio HD
- Dimensões: 270 x 350 x 350 mm
- Disponível nas cores preta e branca',
  180.00,
  153.00,
  'disponível',
  0,
  false,
  'gabinete-mancer-cv100',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 180.00, 153.00,
  0, 'gabinete-mancer-cv100-preto', 'assets/mancer-cv100/cv100-preto-1.jpg',
  array['assets/mancer-cv100/cv100-preto-1.jpg', 'assets/mancer-cv100/cv100-preto-2.jpg', 'assets/mancer-cv100/cv100-preto-3.jpg', 'assets/mancer-cv100/cv100-preto-4.jpg', 'assets/mancer-cv100/cv100-preto-5.jpg', 'assets/mancer-cv100/cv100-preto-6.jpg', 'assets/mancer-cv100/cv100-preto-7.jpg', 'assets/mancer-cv100/cv100-preto-8.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'gabinete-mancer-cv100'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'gabinete-mancer-cv100-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 180.00, 153.00,
  0, 'gabinete-mancer-cv100-branco', 'assets/mancer-cv100/cv100-branco-1.jpg',
  array['assets/mancer-cv100/cv100-branco-1.jpg', 'assets/mancer-cv100/cv100-branco-2.jpg', 'assets/mancer-cv100/cv100-branco-3.jpg', 'assets/mancer-cv100/cv100-branco-4.jpg', 'assets/mancer-cv100/cv100-branco-5.jpg', 'assets/mancer-cv100/cv100-branco-6.jpg', 'assets/mancer-cv100/cv100-branco-7.jpg', 'assets/mancer-cv100/cv100-branco-8.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'gabinete-mancer-cv100'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'gabinete-mancer-cv100-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Gabinete Gamer Mancer CV100 Purple Edition
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Gabinete Gamer Mancer CV100 Purple Edition',
  'gabinete-mancer-cv100-purple-edition',
  (select id from public.categories where slug = 'gabinetes' limit 1),
  'CV100 PE',
  null,
  'Mid Tower com 3 fans Rainbow, lateral e frontal em vidro temperado, interior roxo e opções preto ou branco.',
  'Gabinete Gamer Mancer CV100 Purple Edition com 3 fans Rainbow instaladas, lateral e frontal em vidro temperado, interior roxo, estrutura em aço SPCC e bom espaço interno para setups gamers compactos com visual diferenciado.

Especificações:
- Formato Mid Tower
- Lateral e frontal em vidro temperado
- 3 ventoinhas Rainbow instaladas
- Estrutura em aço SPCC 0.5mm
- Suporte para placas-mãe M-ITX e M-ATX
- Suporte para placa de vídeo de até 320mm
- Altura máxima do cooler do processador de 160mm
- Suporte para até 7 ventoinhas de 120mm
- Water cooler superior de até 240mm
- Water cooler traseiro de 120mm
- Baias: 1x HDD 3.5 polegadas e 3x SSD 2.5 polegadas
- 4 slots de expansão
- Entradas: 1x USB 3.0, 2x USB 2.0 e áudio HD
- Dimensões: 270 x 350 x 350 mm
- Disponível nas cores preta e branca',
  250.00,
  212.50,
  'disponível',
  0,
  false,
  'gabinete-mancer-cv100-purple-edition',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 250.00, 212.50,
  0, 'gabinete-mancer-cv100-purple-edition-preto', 'assets/mancer-cv100-purple/cv100-purple-preto-1.jpg',
  array['assets/mancer-cv100-purple/cv100-purple-preto-1.jpg', 'assets/mancer-cv100-purple/cv100-purple-preto-2.jpg', 'assets/mancer-cv100-purple/cv100-purple-preto-3.jpg', 'assets/mancer-cv100-purple/cv100-purple-preto-4.jpg', 'assets/mancer-cv100-purple/cv100-purple-preto-5.jpg', 'assets/mancer-cv100-purple/cv100-purple-preto-6.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'gabinete-mancer-cv100-purple-edition'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'gabinete-mancer-cv100-purple-edition-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 250.00, 212.50,
  0, 'gabinete-mancer-cv100-purple-edition-branco', 'assets/mancer-cv100-purple/cv100-purple-branco-1.jpg',
  array['assets/mancer-cv100-purple/cv100-purple-branco-1.jpg', 'assets/mancer-cv100-purple/cv100-purple-branco-2.jpg', 'assets/mancer-cv100-purple/cv100-purple-branco-3.jpg', 'assets/mancer-cv100-purple/cv100-purple-branco-4.jpg', 'assets/mancer-cv100-purple/cv100-purple-branco-5.jpg', 'assets/mancer-cv100-purple/cv100-purple-branco-6.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'gabinete-mancer-cv100-purple-edition'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'gabinete-mancer-cv100-purple-edition-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

-- Produto: Gabinete Gamer Mancer CV300
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Gabinete Gamer Mancer CV300',
  'gabinete-mancer-cv300-branco',
  (select id from public.categories where slug = 'gabinetes' limit 1),
  'CV300',
  null,
  'Mid Tower branco, lateral e frontal em vidro temperado, suporte M-ITX/M-ATX e placa de vídeo até 370mm.',
  'Gabinete Gamer Mancer CV300 branco com lateral e frontal em vidro temperado de 4mm, estrutura reforçada em aço SPCC 0.8mm, amplo espaço interno e visual moderno para montar um setup gamer limpo e elegante.

Especificações:
- Formato Mid Tower
- Lateral e frontal em vidro temperado de 4mm
- Estrutura em aço SPCC 0.8mm
- Suporte para placas-mãe M-ITX e M-ATX
- Suporte para placa de vídeo de até 370mm
- Altura máxima do cooler do processador de 155mm
- Suporte para até 9 ventoinhas de 120mm
- Water cooler superior de até 240mm
- Water cooler inferior de até 240mm
- Water cooler traseiro de 120mm
- Baias: 2x HDD 3.5 polegadas + 1x SSD 2.5 polegadas ou 1x HDD + 2x SSD
- 4 slots de expansão
- Entradas: 1x USB 3.0, 2x USB 2.0 e áudio HD
- Dimensões: 270 x 388 x 368 mm
- Cor branca',
  250.00,
  212.50,
  'disponível',
  0,
  false,
  'gabinete-mancer-cv300-branco',
  'Consultar garantia na loja',
  'assets/mancer-cv300/cv300-branco-1.jpg',
  array['assets/mancer-cv300/cv300-branco-1.jpg', 'assets/mancer-cv300/cv300-branco-2.jpg', 'assets/mancer-cv300/cv300-branco-3.jpg', 'assets/mancer-cv300/cv300-branco-4.jpg', 'assets/mancer-cv300/cv300-branco-5.jpg', 'assets/mancer-cv300/cv300-branco-6.jpg', 'assets/mancer-cv300/cv300-branco-7.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Gabinete Gamer Mancer CV500L
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Gabinete Gamer Mancer CV500L',
  'gabinete-mancer-cv500l-branco',
  (select id from public.categories where slug = 'gabinetes' limit 1),
  'CV500L',
  null,
  'Mid Tower branco, lateral e frontal em vidro temperado, USB-C, suporte ATX e placa de vídeo até 380mm.',
  'Gabinete Gamer Mancer CV500L branco com design Clear Vision, lateral e frontal em vidro temperado, lateral metálica vazada para circulação de ar, filtro magnético de poeira, USB-C no painel frontal e amplo espaço interno para setups gamers modernos.

Especificações:
- Formato Mid Tower
- Lateral e frontal em vidro temperado
- Estrutura em aço SPCC 0.5mm
- Vidro temperado de 3mm
- Suporte para placas-mãe M-ITX, M-ATX e ATX
- Suporte para placa de vídeo de até 380mm
- Altura máxima do cooler do processador de 165mm
- Suporte para até 10 ventoinhas de 120mm
- Water cooler superior de até 360mm
- Water cooler lateral de até 240mm
- Water cooler inferior de até 360mm
- Water cooler traseiro de 120mm
- Entradas: 1x USB 2.0, 1x USB 3.0, 1x USB-C e áudio HD
- Baias: 1x HDD 3.5 polegadas e 2x SSD 2.5 polegadas
- Cor branca',
  310.00,
  255.00,
  'disponível',
  0,
  false,
  'gabinete-mancer-cv500l-branco',
  'Consultar garantia na loja',
  'assets/mancer-cv500l/cv500l-branco-1.jpg',
  array['assets/mancer-cv500l/cv500l-branco-1.jpg', 'assets/mancer-cv500l/cv500l-branco-2.jpg', 'assets/mancer-cv500l/cv500l-branco-3.jpg', 'assets/mancer-cv500l/cv500l-branco-4.jpg', 'assets/mancer-cv500l/cv500l-branco-5.jpg', 'assets/mancer-cv500l/cv500l-branco-6.jpg', 'assets/mancer-cv500l/cv500l-branco-7.jpg', 'assets/mancer-cv500l/cv500l-branco-8.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Gabinete Gamer ESGAMING Zero
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Gabinete Gamer ESGAMING Zero',
  'gabinete-esgaming-zero-preto',
  (select id from public.categories where slug = 'gabinetes' limit 1),
  'ZERO',
  null,
  'Mid Tower preto, M-ATX, frontal e lateral em vidro temperado, suporte VGA até 410mm e até 9 fans.',
  'Gabinete Gamer ESGAMING Zero preto com frontal e lateral esquerda em vidro temperado de 4mm, painel inferior com malha inclinada para resfriamento direto da placa de vídeo, lateral direita em malha metálica respirável e suporte móvel para VGA. Um gabinete moderno para setups M-ATX com visual panorâmico.

Especificações:
- Formato Mid Tower
- Suporte para placa-mãe M-ATX
- Frontal e lateral esquerda em vidro temperado de 4mm
- Painel inferior com malha perfurada inclinada em 10 graus
- Painel lateral direito em metal com malha respirável
- Chassi em SPCC 0.6mm
- Suporte para placa de vídeo de até 410mm
- Acompanha suporte móvel para placa de vídeo
- Altura máxima do cooler do processador de 160mm
- Suporte para até 9 ventoinhas de 120mm
- Suporte para radiador superior de 360mm
- Baias: 1x HDD e 2x SSD
- Entradas: 1x USB 3.0, 1x USB 1.0 e áudio HD
- Dimensões do gabinete: 425 x 275 x 360 mm
- Cor preta',
  300.00,
  255.00,
  'disponível',
  0,
  false,
  'gabinete-esgaming-zero-preto',
  'Consultar garantia na loja',
  'assets/esgaming-zero/esgaming-zero-preto-1.jpg',
  array['assets/esgaming-zero/esgaming-zero-preto-1.jpg', 'assets/esgaming-zero/esgaming-zero-preto-2.jpg', 'assets/esgaming-zero/esgaming-zero-preto-3.jpg', 'assets/esgaming-zero/esgaming-zero-preto-4.jpg', 'assets/esgaming-zero/esgaming-zero-preto-5.jpg', 'assets/esgaming-zero/esgaming-zero-preto-6.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Gabinete Gamer TGT Legion
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Gabinete Gamer TGT Legion',
  'gabinete-tgt-legion-preto',
  (select id from public.categories where slug = 'gabinetes' limit 1),
  'Legion',
  null,
  'Mini Tower preto, lateral e frontal em vidro, suporte M-ATX/ITX, até 5 fans e VGA até 280mm.',
  'Gabinete Gamer TGT Legion preto com design compacto, lateral e frontal em vidro, filtro de poeira magnético, painel I/O na parte inferior e estrutura em aço SPCC. Uma opção prática para setups Mini Tower com placa-mãe M-ATX ou ITX.

Especificações:
- Formato Mini Tower
- Painel frontal em vidro de 3mm
- Painel lateral esquerdo em vidro de 3mm
- Material em aço SPCC 0.4mm
- Suporte para placas-mãe M-ATX e ITX
- Suporte para placa de vídeo de até 280mm
- Altura máxima do cooler da CPU de 165mm
- Suporte para até 5 ventoinhas de 120mm
- Water cooler suportado de 240mm
- Baias: 3x SSD ou 2x SSD + 1x HD
- 4 slots PCI
- Entradas: 2x USB 1.1 + áudio
- Dimensões: 195 x 386 x 295 mm
- Garantia de 12 meses
- Cor preta',
  180.00,
  153.00,
  'disponível',
  0,
  false,
  'gabinete-tgt-legion-preto',
  'Consultar garantia na loja',
  'assets/tgt-legion/tgt-legion-preto-1.jpg',
  array['assets/tgt-legion/tgt-legion-preto-1.jpg', 'assets/tgt-legion/tgt-legion-preto-2.jpg', 'assets/tgt-legion/tgt-legion-preto-3.jpg', 'assets/tgt-legion/tgt-legion-preto-4.jpg', 'assets/tgt-legion/tgt-legion-preto-5.jpg', 'assets/tgt-legion/tgt-legion-preto-6.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: SSD Adata Legend 860 1TB NVMe
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'SSD Adata Legend 860 1TB NVMe',
  'ssd-adata-legend-860-1tb',
  (select id from public.categories where slug = 'ssds' limit 1),
  'NVMe',
  null,
  'M.2 2280 NVMe PCIe Gen4 x4, 1TB, leitura até 6.000 MB/s e gravação até 5.000 MB/s.',
  'SSD Adata Legend 860 de 1TB em formato M.2 2280, com interface NVMe PCIe Gen4 x4 e velocidades sequenciais de até 6.000 MB/s de leitura e 5.000 MB/s de gravação. Uma opção de alto desempenho para jogos, programas pesados, edição e upgrades de PC ou notebook compatível.

Especificações:
- Capacidade de 1TB
- Formato M.2 2280
- Interface PCIe Gen4 x4
- Tecnologia 3D NAND
- Leitura sequencial de até 6.000 MB/s
- Gravação sequencial de até 5.000 MB/s
- Dimensões com dissipador: 80 x 22 x 3,13 mm
- Dimensões sem dissipador: 80 x 22 x 2,55 mm
- Peso aproximado de 9,5g com dissipador
- Temperatura de operação de 0°C a 70°C
- Resistência a choque de 1.500G/0,5ms
- MTBF de 2.000.000 horas
- TBW de 640TB
- Garantia limitada de 5 anos pelo fabricante',
  1600.00,
  1360.00,
  'disponível',
  0,
  false,
  'ssd-adata-legend-860-1tb',
  'Consultar garantia na loja',
  'assets/adata-legend-860-1tb/adata-legend-860-1tb-1.jpg',
  array['assets/adata-legend-860-1tb/adata-legend-860-1tb-1.jpg', 'assets/adata-legend-860-1tb/adata-legend-860-1tb-2.jpg', 'assets/adata-legend-860-1tb/adata-legend-860-1tb-3.jpg', 'assets/adata-legend-860-1tb/adata-legend-860-1tb-4.jpg', 'assets/adata-legend-860-1tb/adata-legend-860-1tb-5.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: SSD WD Green SN350 500GB NVMe
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'SSD WD Green SN350 500GB NVMe',
  'ssd-wd-green-sn350-500gb',
  (select id from public.categories where slug = 'ssds' limit 1),
  'SN350',
  null,
  'M.2 2280 NVMe PCIe Gen3, 500GB, leitura até 2.400 MB/s e gravação até 1.500 MB/s.',
  'SSD WD Green SN350 de 500GB em formato M.2 2280 NVMe, ideal para upgrade de PC ou notebook compatível. Oferece desempenho até quatro vezes mais rápido que SSDs SATA, com leitura sequencial de até 2.400 MB/s, gravação de até 1.500 MB/s e tecnologia sem partes móveis para maior resistência contra impactos.

Especificações:
- Capacidade de 500GB
- Formato M.2 2280
- Interface PCIe Gen3 NVMe
- Tipo de NAND TLC
- Leitura sequencial de até 2.400 MB/s
- Gravação sequencial de até 1.500 MB/s
- Leitura randômica 4K de até 300K IOPS
- Gravação randômica 4K de até 300K IOPS
- Durabilidade de 60 TBW
- MTTF de até 1.000.000 horas
- Temperatura operacional de 0°C a 70°C
- Resistência a choque de 1.500G/0,5ms
- Dimensões: 80 x 22 x 2,38 mm
- Peso aproximado de 7,5g
- Garantia de 12 meses',
  900.00,
  765.00,
  'disponível',
  0,
  false,
  'ssd-wd-green-sn350-500gb',
  'Consultar garantia na loja',
  'assets/wd-green-sn350-500gb/wd-green-sn350-500gb-1.jpg',
  array['assets/wd-green-sn350-500gb/wd-green-sn350-500gb-1.jpg', 'assets/wd-green-sn350-500gb/wd-green-sn350-500gb-2.jpg', 'assets/wd-green-sn350-500gb/wd-green-sn350-500gb-3.jpg', 'assets/wd-green-sn350-500gb/wd-green-sn350-500gb-4.jpg', 'assets/wd-green-sn350-500gb/wd-green-sn350-500gb-5.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: SSD Rise Mode Gamer Line 120GB
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'SSD Rise Mode Gamer Line 120GB',
  'ssd-rise-mode-gamer-line-120gb',
  (select id from public.categories where slug = 'ssds' limit 1),
  '120GB',
  null,
  'SSD 2,5 polegadas SATA III, 120GB, leitura até 530 MB/s e gravação até 520 MB/s.',
  'SSD Rise Mode Gamer Line de 120GB em formato 2,5 polegadas SATA III, ideal para melhorar inicialização do sistema, abertura de programas e tempo de carregamento em PCs e notebooks compatíveis. Uma opção prática para upgrade de máquinas que ainda usam HD.

Especificações:
- Capacidade de 120GB
- Formato 2,5 polegadas
- Interface SATA III 6 Gb/s
- Espessura de 7mm
- Leitura sequencial de até 530 MB/s
- Gravação sequencial de até 520 MB/s
- IOPS de leitura aleatória 4K de até 40K
- IOPS de gravação aleatória 4K de até 86K
- Consumo típico de 2,0W
- Consumo inativo de 0,3W
- Temperatura de operação de 0°C a 70°C
- MTBF de 2.000.000 horas
- Compatível com Windows, Linux e Mac OS X
- Garantia de 1 ano
- Cor preta',
  200.00,
  170.00,
  'disponível',
  0,
  false,
  'ssd-rise-mode-gamer-line-120gb',
  'Consultar garantia na loja',
  'assets/rise-mode-ssd-120gb/rise-mode-ssd-120gb-1.jpg',
  array['assets/rise-mode-ssd-120gb/rise-mode-ssd-120gb-1.jpg', 'assets/rise-mode-ssd-120gb/rise-mode-ssd-120gb-2.jpg', 'assets/rise-mode-ssd-120gb/rise-mode-ssd-120gb-3.jpg', 'assets/rise-mode-ssd-120gb/rise-mode-ssd-120gb-4.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: SSD Rise Mode Gamer Line 240GB
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'SSD Rise Mode Gamer Line 240GB',
  'ssd-rise-mode-gamer-line-240gb',
  (select id from public.categories where slug = 'ssds' limit 1),
  '240GB',
  null,
  'SSD 2,5 polegadas SATA III, 240GB, leitura até 530 MB/s e gravação até 520 MB/s.',
  'SSD Rise Mode Gamer Line de 240GB em formato 2,5 polegadas SATA III, indicado para melhorar a velocidade de inicialização, abertura de programas e carregamento de jogos em PCs e notebooks compatíveis com armazenamento SATA.

Especificações:
- Capacidade de 240GB
- Formato 2,5 polegadas
- Interface SATA III 6 Gb/s
- Espessura de 7mm
- Leitura sequencial de até 530 MB/s
- Gravação sequencial de até 520 MB/s
- IOPS de leitura aleatória 4K de até 40K
- IOPS de gravação aleatória 4K de até 86K
- Consumo típico de 2,0W
- Consumo inativo de 0,3W
- Temperatura de operação de 0°C a 70°C
- MTBF de 2.000.000 horas
- Compatível com Windows, Linux e Mac OS X
- Garantia de 1 ano
- Cor preta',
  400.00,
  340.00,
  'disponível',
  0,
  false,
  'ssd-rise-mode-gamer-line-240gb',
  'Consultar garantia na loja',
  'assets/rise-mode-ssd-240gb/rise-mode-ssd-240gb-4.jpg',
  array['assets/rise-mode-ssd-240gb/rise-mode-ssd-240gb-4.jpg', 'assets/rise-mode-ssd-240gb/rise-mode-ssd-240gb-1.jpg', 'assets/rise-mode-ssd-240gb/rise-mode-ssd-240gb-2.jpg', 'assets/rise-mode-ssd-240gb/rise-mode-ssd-240gb-3.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Memória RAM Rise Mode Z 8GB DDR4
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Memória RAM Rise Mode Z 8GB DDR4',
  'memoria-rise-mode-z-8gb-3200mhz',
  (select id from public.categories where slug = 'memorias-ram' limit 1),
  '8GB',
  null,
  '8GB DDR4, 3200MHz, CL19, 288 pinos DIMM, dissipador preto e tensão de 1.35V.',
  'Memória RAM Rise Mode Z Series de 8GB DDR4 3200MHz, indicada para upgrade de PCs compatíveis, melhorando multitarefa, navegação, programas do dia a dia e desempenho em jogos leves. Possui dissipador preto com visual gamer e formato 288 pinos DIMM.

Especificações:
- Capacidade de 8GB
- Tipo DDR4
- Frequência de 3200MHz
- Latência CL19-19-19-43
- Tensão de 1.35V
- Formato 288 pinos DIMM
- Modelo Z Series 8GB preta
- Part number RM-D4-8G-3200Z
- Dissipador preto com visual gamer
- Indicada para upgrade de PCs compatíveis
- Incompatível com placa-mãe chipset Intel B660, conforme fabricante
- Garantia de 6 meses
- Cor preta',
  420.00,
  357.00,
  'disponível',
  0,
  false,
  'memoria-rise-mode-z-8gb-3200mhz',
  'Consultar garantia na loja',
  'assets/rise-mode-z-8gb-ddr4/rise-mode-z-8gb-ddr4-1.jpg',
  array['assets/rise-mode-z-8gb-ddr4/rise-mode-z-8gb-ddr4-1.jpg', 'assets/rise-mode-z-8gb-ddr4/rise-mode-z-8gb-ddr4-2.jpg', 'assets/rise-mode-z-8gb-ddr4/rise-mode-z-8gb-ddr4-3.jpg', 'assets/rise-mode-z-8gb-ddr4/rise-mode-z-8gb-ddr4-4.jpg', 'assets/rise-mode-z-8gb-ddr4/rise-mode-z-8gb-ddr4-5.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Memória RAM Crucial Ballistix 8GB DDR4
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Memória RAM Crucial Ballistix 8GB DDR4',
  'memoria-crucial-ballistix-8gb-2666mhz-red',
  (select id from public.categories where slug = 'memorias-ram' limit 1),
  '8GB',
  null,
  '8GB DDR4, 2666MHz, CL16, UDIMM, dissipador vermelho e tensão de 1.2V.',
  'Memória RAM Crucial Ballistix de 8GB DDR4 2666MHz, com dissipador vermelho em alumínio anodizado, suporte XMP 2.0 e compatibilidade com plataformas AMD e Intel. Uma opção para upgrade de PCs compatíveis que precisam de mais desempenho em jogos, multitarefa e uso diário.

Especificações:
- Capacidade de 8GB
- Tipo DDR4
- Frequência de 2666MHz
- Latência CAS CL16
- Tempos 16-18-18-38
- Tensão de 1.2V
- Tipo de módulo UDIMM
- Unbuffered e Non-ECC
- Velocidade PC4-21300
- Suporte XMP 2.0
- Compatível com plataformas AMD e Intel
- Dissipador vermelho em alumínio anodizado
- Modelo BL8G26C16U4R
- Garantia de 10 anos pelo fabricante
- Cor vermelha',
  400.00,
  340.00,
  'disponível',
  0,
  false,
  'memoria-crucial-ballistix-8gb-2666mhz-red',
  'Consultar garantia na loja',
  'assets/crucial-ballistix-8gb-red/crucial-ballistix-red-1.jpg',
  array['assets/crucial-ballistix-8gb-red/crucial-ballistix-red-1.jpg', 'assets/crucial-ballistix-8gb-red/crucial-ballistix-red-2.jpg', 'assets/crucial-ballistix-8gb-red/crucial-ballistix-red-3.jpg', 'assets/crucial-ballistix-8gb-red/crucial-ballistix-red-4.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Memória RAM Kingston Fury Beast 4GB DDR4
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Memória RAM Kingston Fury Beast 4GB DDR4',
  'memoria-kingston-fury-beast-4gb-2666mhz',
  (select id from public.categories where slug = 'memorias-ram' limit 1),
  '4GB',
  null,
  '4GB DDR4, 2666MHz, CL16, dissipador preto de baixo perfil, Intel XMP-ready e AMD Ryzen-ready.',
  'Memória RAM Kingston Fury Beast de 4GB DDR4 2666MHz, com dissipador de calor preto de baixo perfil, suporte Intel XMP e compatibilidade com plataformas AMD Ryzen. Uma opção para upgrades simples em PCs compatíveis que precisam de mais memória para uso diário.

Especificações:
- Capacidade de 4GB
- Tipo DDR4
- Frequência de 2666MHz
- Latência CL16
- Modelo KF426C16BB/4
- Dissipador de calor de perfil baixo
- Intel XMP-ready
- Pronta para AMD Ryzen
- Dimensões: 133,35 x 34,1 x 7,2 mm
- Temperatura de operação de 0°C a 85°C
- Conteúdo: 1 memória Kingston Fury Beast 4GB
- Garantia de 10 anos pelo fabricante
- Cor preta',
  300.00,
  255.00,
  'disponível',
  0,
  false,
  'memoria-kingston-fury-beast-4gb-2666mhz',
  'Consultar garantia na loja',
  'assets/kingston-fury-beast-4gb/kingston-fury-beast-4gb-3.jpg',
  array['assets/kingston-fury-beast-4gb/kingston-fury-beast-4gb-3.jpg', 'assets/kingston-fury-beast-4gb/kingston-fury-beast-4gb-4.jpg', 'assets/kingston-fury-beast-4gb/kingston-fury-beast-4gb-2.jpg', 'assets/kingston-fury-beast-4gb/kingston-fury-beast-4gb-1.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Memória RAM Kingston Fury Impact 8GB DDR4
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Memória RAM Kingston Fury Impact 8GB DDR4',
  'memoria-kingston-fury-impact-8gb-3200mhz',
  (select id from public.categories where slug = 'memorias-ram' limit 1),
  '8GB',
  null,
  '8GB DDR4 SODIMM, 3200MHz, CL20, 260 pinos, 1.2V, para notebooks e notebooks gamers.',
  'Memória RAM Kingston Fury Impact de 8GB DDR4 3200MHz para notebook, em formato SODIMM 260 pinos. Oferece overclock automático Plug N Play, perfis Intel XMP e compatibilidade com AMD Ryzen, sendo uma ótima opção para melhorar multitarefa, jogos e uso diário em notebooks compatíveis.

Especificações:
- Capacidade de 8GB
- Tipo DDR4
- Formato SODIMM 260 pinos
- Frequência de 3200MHz
- Latência CL20
- Voltagem de 1.2V
- Modelo KF432S20IB/8
- Compatível com notebooks e notebooks gamers
- Plug N Play com overclock automático até 3200MHz
- Perfis Intel XMP prontos
- Pronta para AMD Ryzen
- Dimensões: 69,6 x 30 mm
- Temperatura de operação de 0°C a 85°C
- Garantia de 10 anos pelo fabricante
- Cor preta',
  380.00,
  323.00,
  'disponível',
  0,
  false,
  'memoria-kingston-fury-impact-8gb-3200mhz',
  'Consultar garantia na loja',
  'assets/kingston-fury-impact-8gb/kingston-fury-impact-8gb-2.jpg',
  array['assets/kingston-fury-impact-8gb/kingston-fury-impact-8gb-2.jpg', 'assets/kingston-fury-impact-8gb/kingston-fury-impact-8gb-1.jpg', 'assets/kingston-fury-impact-8gb/kingston-fury-impact-8gb-3.jpg', 'assets/kingston-fury-impact-8gb/kingston-fury-impact-8gb-4.jpg', 'assets/kingston-fury-impact-8gb/kingston-fury-impact-8gb-5.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Fonte Gigabyte P650G PG5 650W
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Fonte Gigabyte P650G PG5 650W',
  'fonte-gigabyte-p650g-pg5-650w',
  (select id from public.categories where slug = 'fontes' limit 1),
  '650W',
  null,
  '650W, 80 Plus Gold, PFC ativo, PCIe 5.0, conector 12VHPWR e ventoinha de 120mm.',
  'Fonte Gigabyte P650G PG5 de 650W com certificação 80 Plus Gold, PFC ativo, suporte nativo a PCIe 5.0 e conector 12VHPWR de 16 pinos para placas de vídeo modernas. Conta com capacitores principais japoneses, proteções completas e cabos flat pretos para facilitar a organização do setup.

Especificações:
- Potência de 650W
- Certificação 80 Plus Gold
- PFC ativo
- Suporte nativo a PCIe 5.0
- Conector 12VHPWR de 16 pinos com suporte até 450W
- Capacitores principais japoneses
- Ventoinha de 120mm com rolamento hidráulico
- Formato ATX 12V
- Entrada 100-240V Full Range
- MTBF superior a 100.000 horas
- Proteções OVP, OPP, SCP, UVP, OCP e OTP
- Conectores: 1x ATX 20+4, 2x CPU 4+4, 2x PCIe 6+2, 6x SATA e 3x periférico
- Dimensões: 150 x 140 x 86 mm
- Garantia de 5 anos pelo fabricante
- Cor preta',
  400.00,
  340.00,
  'disponível',
  0,
  false,
  'fonte-gigabyte-p650g-pg5-650w',
  'Consultar garantia na loja',
  'assets/gigabyte-p650g-pg5/gigabyte-p650g-pg5-5.jpg',
  array['assets/gigabyte-p650g-pg5/gigabyte-p650g-pg5-5.jpg', 'assets/gigabyte-p650g-pg5/gigabyte-p650g-pg5-3.jpg', 'assets/gigabyte-p650g-pg5/gigabyte-p650g-pg5-2.jpg', 'assets/gigabyte-p650g-pg5/gigabyte-p650g-pg5-4.jpg', 'assets/gigabyte-p650g-pg5/gigabyte-p650g-pg5-1.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Fonte Mach1 Steady 650W
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Fonte Mach1 Steady 650W',
  'fonte-mach1-steady-650w',
  (select id from public.categories where slug = 'fontes' limit 1),
  '650W',
  null,
  '650W, 80 Plus Bronze, PFC ativo, ATX 2.52, ventoinha de 120mm e proteções industriais.',
  'Fonte Mach1 Steady 650W com certificação 80 Plus Bronze, PFC ativo, ventoinha de 120mm e compatibilidade ATX 2.52. Conta com proteções contra sobretensão, subtensão, curto-circuito, sobrecarga, operação sem carga e surtos, sendo uma opção equilibrada para setups com boa eficiência e segurança.

Especificações:
- Potência de 650W
- Certificação 80 Plus Bronze
- PFC ativo
- Compatível com ATX 2.52
- Fator de forma ATX
- Ventoinha de 120mm
- Entrada 100-240V Full Range
- Frequência de entrada 50/60Hz
- Proteções OVP, UVP, SCP, OPP, NLO e SIP
- 1x cabo ATX 24 pinos
- 1x cabo EPS 4+4 pinos
- 2x cabos PCIe 6+2 pinos
- 2x cabos SATA com 3 conectores
- 1x cabo Molex com 3 conectores
- Garantia de 3 anos pelo fabricante',
  320.00,
  272.00,
  'disponível',
  0,
  false,
  'fonte-mach1-steady-650w',
  'Consultar garantia na loja',
  'assets/mach1-steady-650w/mach1-steady-650w-4.jpg',
  array['assets/mach1-steady-650w/mach1-steady-650w-4.jpg', 'assets/mach1-steady-650w/mach1-steady-650w-3.jpg', 'assets/mach1-steady-650w/mach1-steady-650w-5.jpg', 'assets/mach1-steady-650w/mach1-steady-650w-2.jpg', 'assets/mach1-steady-650w/mach1-steady-650w-1.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Fonte TGT Enfield 500W
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Fonte TGT Enfield 500W',
  'fonte-tgt-enfield-500w',
  (select id from public.categories where slug = 'fontes' limit 1),
  '500W',
  null,
  '500W, ATX bivolt, não modular, ventoinha de 120mm, cabos flat pretos e proteções OVP/UVP/SCP/OPP.',
  'Fonte TGT Enfield 500W ATX bivolt, indicada para computadores de escritório e setups gamers de entrada. Possui ventoinha de 120mm, cabos flat pretos para melhor organização, construção em PCB FR-4, processo SMD e proteções contra sobretensão, subtensão, curto-circuito e sobrecarga.

Especificações:
- Potência de 500W
- Formato ATX 2.31
- Bivolt 100-240V sem chaveamento manual
- Não modular
- Ventoinha de 120mm
- Velocidade da ventoinha de 1800 RPM ±10%
- Rolamento hidráulico
- Proteções OVP, UVP, SCP e OPP
- PCB em material FR-4
- Cabos flat pretos
- 1x conector 24 pinos
- 1x conector P8 4+4
- 1x conector PCIe 6+2
- Conectores SATA e Molex
- Não acompanha cabo de alimentação',
  200.00,
  170.00,
  'disponível',
  0,
  false,
  'fonte-tgt-enfield-500w',
  'Consultar garantia na loja',
  'assets/tgt-enfield-500w/tgt-enfield-500w-4.jpg',
  array['assets/tgt-enfield-500w/tgt-enfield-500w-4.jpg', 'assets/tgt-enfield-500w/tgt-enfield-500w-3.jpg', 'assets/tgt-enfield-500w/tgt-enfield-500w-1.jpg', 'assets/tgt-enfield-500w/tgt-enfield-500w-6.jpg', 'assets/tgt-enfield-500w/tgt-enfield-500w-2.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Controle PS5 DualSense
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Controle PS5 DualSense',
  'controle-ps5-dualsense',
  (select id from public.categories where slug = 'controles' limit 1),
  'PS5',
  null,
  'Controle sem fio DualSense para PS5, com feedback tátil, gatilhos adaptáveis, microfone integrado e conexão USB-C.',
  'Controle sem fio Sony DualSense para PlayStation 5, com design ergonômico, feedback tátil, gatilhos adaptáveis, sensor de movimento, microfone integrado, entrada para headset e bateria recarregável. Disponível em Midnight Black, Branco e Cosmic Red.

Especificações:
- Controle sem fio original Sony DualSense
- Compatível com PlayStation 5
- Conexão sem fio Bluetooth
- Porta USB-C para carregamento e uso com cabo
- Feedback tátil
- Gatilhos adaptáveis
- Microfone integrado
- Entrada para headset
- Sensor de movimento
- Botão Create
- Bateria recarregável integrada
- Disponível nas cores Midnight Black, Branco e Cosmic Red',
  500.00,
  425.00,
  'disponível',
  0,
  false,
  'controle-ps5-dualsense',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Midnight Black', 'Midnight Black',
  'Midnight Black', 500.00, 425.00,
  0, 'controle-ps5-dualsense-midnight-black', 'assets/dualsense-ps5/dualsense-preto-3.jpg',
  array['assets/dualsense-ps5/dualsense-preto-3.jpg', 'assets/dualsense-ps5/dualsense-preto-7.jpg', 'assets/dualsense-ps5/dualsense-preto-5.jpg', 'assets/dualsense-ps5/dualsense-preto-2.jpg', 'assets/dualsense-ps5/dualsense-preto-6.jpg', 'assets/dualsense-ps5/dualsense-preto-8.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-ps5-dualsense'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-ps5-dualsense-midnight-black'
    and coalesce(existing.name, '') = 'Midnight Black'
    and coalesce(existing.color, '') = 'Midnight Black'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 500.00, 425.00,
  0, 'controle-ps5-dualsense-branco', 'assets/dualsense-ps5/dualsense-branco-6.jpg',
  array['assets/dualsense-ps5/dualsense-branco-6.jpg', 'assets/dualsense-ps5/dualsense-branco-1.jpg', 'assets/dualsense-ps5/dualsense-branco-2.jpg', 'assets/dualsense-ps5/dualsense-branco-3.jpg', 'assets/dualsense-ps5/dualsense-branco-4.jpg', 'assets/dualsense-ps5/dualsense-branco-5.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-ps5-dualsense'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-ps5-dualsense-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Cosmic Red', 'Cosmic Red',
  'Cosmic Red', 550.00, 467.50,
  0, 'controle-ps5-dualsense-cosmic-red', 'assets/dualsense-ps5/dualsense-vermelho-1.jpg',
  array['assets/dualsense-ps5/dualsense-vermelho-1.jpg', 'assets/dualsense-ps5/dualsense-vermelho-2.jpg', 'assets/dualsense-ps5/dualsense-vermelho-3.jpg', 'assets/dualsense-ps5/dualsense-vermelho-4.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-ps5-dualsense'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-ps5-dualsense-cosmic-red'
    and coalesce(existing.name, '') = 'Cosmic Red'
    and coalesce(existing.color, '') = 'Cosmic Red'
);

-- Produto: Controle Xbox Series X/S
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Controle Xbox Series X/S',
  'controle-xbox-series',
  (select id from public.categories where slug = 'controles' limit 1),
  'XBOX',
  null,
  'Controle sem fio Xbox Series X/S com conexão Xbox Wireless e Bluetooth, direcional híbrido e botão de compartilhamento.',
  'Controle sem fio Microsoft Xbox para Xbox Series X/S, Xbox One, PC Windows e dispositivos compatíveis. Traz conexão Xbox Wireless e Bluetooth, direcional híbrido, botão de compartilhamento, gatilhos texturizados e entrada P2 para headset.

Especificações:
- Controle sem fio Microsoft Xbox
- Compatível com Xbox Series X/S, Xbox One e PC Windows
- Conexão Xbox Wireless e Bluetooth
- Direcional híbrido
- Botão de compartilhamento
- Gatilhos e botões superiores texturizados
- Entrada P2 de 3,5 mm para headset
- Conexão USB-C para uso com cabo
- Mapeamento de botões pelo aplicativo Acessórios Xbox
- Disponível nas cores Carbon Black, Branco e Velocity Green',
  500.00,
  425.00,
  'disponível',
  0,
  false,
  'controle-xbox-series',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Carbon Black', 'Carbon Black',
  'Carbon Black', 500.00, 425.00,
  0, 'controle-xbox-series-carbon-black', 'assets/xbox-series-controller/xbox-preto-1.jpg',
  array['assets/xbox-series-controller/xbox-preto-1.jpg', 'assets/xbox-series-controller/xbox-preto-2.jpg', 'assets/xbox-series-controller/xbox-preto-3.jpg', 'assets/xbox-series-controller/xbox-preto-4.jpg', 'assets/xbox-series-controller/xbox-preto-5.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-xbox-series'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-xbox-series-carbon-black'
    and coalesce(existing.name, '') = 'Carbon Black'
    and coalesce(existing.color, '') = 'Carbon Black'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 500.00, 425.00,
  0, 'controle-xbox-series-branco', 'assets/xbox-series-controller/xbox-branco-1.jpg',
  array['assets/xbox-series-controller/xbox-branco-1.jpg', 'assets/xbox-series-controller/xbox-branco-4.jpg', 'assets/xbox-series-controller/xbox-branco-2.jpg', 'assets/xbox-series-controller/xbox-branco-3.jpg', 'assets/xbox-series-controller/xbox-branco-5.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-xbox-series'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-xbox-series-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Velocity Green', 'Velocity Green',
  'Velocity Green', 500.00, 425.00,
  0, 'controle-xbox-series-velocity-green', 'assets/xbox-series-controller/xbox-verde-1.jpg',
  array['assets/xbox-series-controller/xbox-verde-1.jpg', 'assets/xbox-series-controller/xbox-verde-2.jpg', 'assets/xbox-series-controller/xbox-verde-3.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-xbox-series'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-xbox-series-velocity-green'
    and coalesce(existing.name, '') = 'Velocity Green'
    and coalesce(existing.color, '') = 'Velocity Green'
);

-- Produto: Controle GameSir Nova Lite T4
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Controle GameSir Nova Lite T4',
  'controle-gamesir-nova-lite-t4',
  (select id from public.categories where slug = 'controles' limit 1),
  'T4',
  null,
  'Controle multi-plataforma tri-mode com Hall Effect anti-drift, Turbo, vibração e conexões Bluetooth, 2.4G e USB-C.',
  'Controle GameSir Nova Lite T4 multi-plataforma, com sticks Hall Effect anti-drift, conexão tri-mode via Bluetooth, dongle 2.4G e USB-C, função Turbo, motores de vibração e design ergonômico para PC, Steam, Nintendo Switch, iOS e Android.

Especificações:
- Controle multi-plataforma GameSir Nova Lite T4
- Sticks GameSir Hall Effect anti-drift
- Conexão tri-mode: Bluetooth, dongle 2.4G e USB-C
- Compatível com PC, Steam, Nintendo Switch, iOS e Android
- Função Turbo
- Motores de vibração
- Botões personalizáveis
- Bateria de 600 mAh
- Design ergonômico
- Acompanha receptor USB
- Disponível nas cores Preto, Branco e Cinza',
  200.00,
  170.00,
  'disponível',
  0,
  false,
  'controle-gamesir-nova-lite-t4',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Preto', 'Preto',
  'Preto', 200.00, 170.00,
  0, 'controle-gamesir-nova-lite-t4-preto', 'assets/gamesir-nova-lite-t4/gamesir-preto-1.jpg',
  array['assets/gamesir-nova-lite-t4/gamesir-preto-1.jpg', 'assets/gamesir-nova-lite-t4/gamesir-preto-2.jpg', 'assets/gamesir-nova-lite-t4/gamesir-preto-3.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-gamesir-nova-lite-t4'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-gamesir-nova-lite-t4-preto'
    and coalesce(existing.name, '') = 'Preto'
    and coalesce(existing.color, '') = 'Preto'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Branco', 'Branco',
  'Branco', 230.00, 195.50,
  0, 'controle-gamesir-nova-lite-t4-branco', 'assets/gamesir-nova-lite-t4/gamesir-branco-1.jpg',
  array['assets/gamesir-nova-lite-t4/gamesir-branco-1.jpg', 'assets/gamesir-nova-lite-t4/gamesir-branco-7.jpg', 'assets/gamesir-nova-lite-t4/gamesir-branco-2.jpg', 'assets/gamesir-nova-lite-t4/gamesir-branco-3.jpg', 'assets/gamesir-nova-lite-t4/gamesir-branco-4.jpg', 'assets/gamesir-nova-lite-t4/gamesir-branco-5.jpg', 'assets/gamesir-nova-lite-t4/gamesir-branco-6.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-gamesir-nova-lite-t4'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-gamesir-nova-lite-t4-branco'
    and coalesce(existing.name, '') = 'Branco'
    and coalesce(existing.color, '') = 'Branco'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Cinza', 'Cinza',
  'Cinza', 230.00, 195.50,
  0, 'controle-gamesir-nova-lite-t4-cinza', 'assets/gamesir-nova-lite-t4/gamesir-cinza-1.jpg',
  array['assets/gamesir-nova-lite-t4/gamesir-cinza-1.jpg', 'assets/gamesir-nova-lite-t4/gamesir-cinza-3.jpg', 'assets/gamesir-nova-lite-t4/gamesir-cinza-5.jpg', 'assets/gamesir-nova-lite-t4/gamesir-cinza-2.jpg', 'assets/gamesir-nova-lite-t4/gamesir-cinza-4.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-gamesir-nova-lite-t4'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-gamesir-nova-lite-t4-cinza'
    and coalesce(existing.name, '') = 'Cinza'
    and coalesce(existing.color, '') = 'Cinza'
);

-- Produto: Controle GameSir Cyclone 2
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Controle GameSir Cyclone 2',
  'controle-gamesir-cyclone-2',
  (select id from public.categories where slug = 'controles' limit 1),
  'C2',
  null,
  'Controle multi-plataforma com dock de carregamento, sticks Mag-Res TMR, gatilhos Hall Effect, RGB e conexão tri-mode.',
  'Controle GameSir Cyclone 2 Bundle Edition com base de carregamento, conexão Bluetooth, 2.4G via dongle e USB-C. Traz sticks Mag-Res TMR de alta precisão, gatilhos Hall Effect, botões micro switch, vibração, giroscópio de 6 eixos, botões traseiros personalizáveis e iluminação RGB.

Especificações:
- Controle GameSir Cyclone 2 Bundle Edition
- Acompanha dock/base de carregamento
- Conexão tri-mode: Bluetooth, 2.4G e USB-C
- Compatível com PC, Steam, Nintendo Switch, iOS e Android
- Sticks GameSir Mag-Res TMR
- Gatilhos Hall Effect
- Botões ABXY micro switch
- Giroscópio de 6 eixos
- Motores de vibração assimétricos
- Botões traseiros personalizáveis
- Iluminação RGB
- Bateria de 860 mAh
- Disponível nas cores Shadow Black e Phantom White',
  420.00,
  357.00,
  'disponível',
  0,
  false,
  'controle-gamesir-cyclone-2',
  'Consultar garantia na loja',
  null,
  '{}'::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Shadow Black', 'Shadow Black',
  'Shadow Black', 420.00, 357.00,
  0, 'controle-gamesir-cyclone-2-shadow-black', 'assets/gamesir-cyclone-2/cyclone-preto-ktc-1.jpg',
  array['assets/gamesir-cyclone-2/cyclone-preto-ktc-1.jpg', 'assets/gamesir-cyclone-2/cyclone-preto-ktc-2.jpg', 'assets/gamesir-cyclone-2/cyclone-preto-ktc-3.jpg', 'assets/gamesir-cyclone-2/cyclone-preto-ktc-4.jpg', 'assets/gamesir-cyclone-2/cyclone-preto-ktc-5.jpg', 'assets/gamesir-cyclone-2/cyclone-preto-ktc-6.jpg', 'assets/gamesir-cyclone-2/cyclone-preto-ktc-7.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-gamesir-cyclone-2'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-gamesir-cyclone-2-shadow-black'
    and coalesce(existing.name, '') = 'Shadow Black'
    and coalesce(existing.color, '') = 'Shadow Black'
);

insert into public.product_variations (
  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status
)
select
  p.id, 'Phantom White', 'Phantom White',
  'Phantom White', 420.00, 357.00,
  0, 'controle-gamesir-cyclone-2-phantom-white', 'assets/gamesir-cyclone-2/cyclone-branco-tb-1.jpg',
  array['assets/gamesir-cyclone-2/cyclone-branco-tb-1.jpg', 'assets/gamesir-cyclone-2/cyclone-branco-tb-2.jpg', 'assets/gamesir-cyclone-2/cyclone-branco-tb-3.jpg', 'assets/gamesir-cyclone-2/cyclone-branco-tb-4.jpg', 'assets/gamesir-cyclone-2/cyclone-branco-tb-5.jpg', 'assets/gamesir-cyclone-2/cyclone-branco-tb-6.jpg']::text[], true, 'ativo'
from public.products p where p.slug = 'controle-gamesir-cyclone-2'
and not exists (
  select 1 from public.product_variations existing
  where existing.product_id = p.id
    and coalesce(existing.sku, '') = 'controle-gamesir-cyclone-2-phantom-white'
    and coalesce(existing.name, '') = 'Phantom White'
    and coalesce(existing.color, '') = 'Phantom White'
);

-- Produto: Controle GameSir G7 Pro
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Controle GameSir G7 Pro',
  'controle-gamesir-g7-pro',
  (select id from public.categories where slug = 'controles' limit 1),
  'G7',
  null,
  'Controle GameSir G7 Pro para Xbox, PC e Android, com base de carregamento, conexão tri-mode e sticks Mag-Res TMR.',
  'Controle GameSir G7 Pro compatível com Xbox, PC e Android, com conexão tri-mode, dock/base de carregamento, sticks Mag-Res TMR, gatilhos Hall Effect, botões traseiros personalizáveis, vibração e design ergonômico para jogos competitivos.

Especificações:
- Controle GameSir G7 Pro
- Compatível com Xbox, PC e Android
- Conexão tri-mode
- Acompanha base/dock de carregamento
- Sticks GameSir Mag-Res TMR
- Gatilhos Hall Effect
- Botões traseiros personalizáveis
- Motores de vibração
- Design ergonômico
- Cor preta',
  550.00,
  467.50,
  'disponível',
  0,
  false,
  'controle-gamesir-g7-pro',
  'Consultar garantia na loja',
  'assets/gamesir-g7-pro/gamesir-g7-pro-1.jpg',
  array['assets/gamesir-g7-pro/gamesir-g7-pro-1.jpg', 'assets/gamesir-g7-pro/gamesir-g7-pro-3.jpg', 'assets/gamesir-g7-pro/gamesir-g7-pro-4.jpg', 'assets/gamesir-g7-pro/gamesir-g7-pro-2.png', 'assets/gamesir-g7-pro/gamesir-g7-pro-5.png']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Controle QRD Spark N5
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Controle QRD Spark N5',
  'controle-qrd-spark-n5',
  (select id from public.categories where slug = 'controles' limit 1),
  'N5',
  null,
  'Controle sem fio QRD Spark N5 para PS5, PS4, PC, iOS e Android, com sticks Hall Effect e botões macro.',
  'Controle QRD Spark N5 sem fio com proposta multi-plataforma para PlayStation 5, PlayStation 4, PC, iOS e Android. Traz sticks Hall Effect, botões macro traseiros, conexão versátil, bateria de longa duração e layout confortável para jogos no console, computador e celular.

Especificações:
- Controle sem fio QRD Spark N5
- Compatível com PS5, PS4, PC, iOS e Android
- Sticks Hall Effect
- Botões macro traseiros
- Conexão versátil multi-plataforma
- Bateria de longa duração
- Layout ergonômico
- Cor preta',
  300.00,
  255.00,
  'disponível',
  0,
  false,
  'controle-qrd-spark-n5',
  'Consultar garantia na loja',
  'assets/qrd-spark-n5/qrd-spark-n5-5.jpg',
  array['assets/qrd-spark-n5/qrd-spark-n5-5.jpg', 'assets/qrd-spark-n5/qrd-spark-n5-1.jpg', 'assets/qrd-spark-n5/qrd-spark-n5-2.jpg', 'assets/qrd-spark-n5/qrd-spark-n5-3.jpg', 'assets/qrd-spark-n5/qrd-spark-n5-4.jpg', 'assets/qrd-spark-n5/qrd-spark-n5-6.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

-- Produto: Controle 8BitDo Ultimate C Xbox
insert into public.products (
  name, slug, category_id, brand, model, short_description, full_description,
  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes
)
values (
  'Controle 8BitDo Ultimate C Xbox',
  'controle-8bitdo-ultimate-c-xbox',
  (select id from public.categories where slug = 'controles' limit 1),
  '8BD',
  null,
  'Controle com fio 8BitDo Ultimate C para Xbox, na cor verde escuro, com layout confortável e conexão USB.',
  'Controle com fio 8BitDo Ultimate C para Xbox em verde escuro, com conexão USB, botões responsivos, direcional preciso, gatilhos analógicos e layout ergonômico para jogar no Xbox e PC.

Especificações:
- Controle com fio 8BitDo Ultimate C para Xbox
- Compatível com Xbox e PC
- Conexão USB com fio
- Gatilhos analógicos
- Direcional preciso
- Botões responsivos
- Layout ergonômico
- Cor verde escuro',
  250.00,
  212.50,
  'disponível',
  0,
  false,
  'controle-8bitdo-ultimate-c-xbox',
  'Consultar garantia na loja',
  'assets/8bitdo-ultimate-c-xbox/8bitdo-ultimate-c-1.jpg',
  array['assets/8bitdo-ultimate-c-xbox/8bitdo-ultimate-c-1.jpg', 'assets/8bitdo-ultimate-c-xbox/8bitdo-ultimate-c-6.jpg', 'assets/8bitdo-ultimate-c-xbox/8bitdo-ultimate-c-2.jpg', 'assets/8bitdo-ultimate-c-xbox/8bitdo-ultimate-c-3.jpg', 'assets/8bitdo-ultimate-c-xbox/8bitdo-ultimate-c-4.jpg', 'assets/8bitdo-ultimate-c-xbox/8bitdo-ultimate-c-5.jpg']::text[],
  'Importado do catalogo publico em public/produtos/app.js'
)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  brand = excluded.brand,
  model = excluded.model,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  promo_price = excluded.promo_price,
  status = excluded.status,
  stock = excluded.stock,
  featured = excluded.featured,
  sku = excluded.sku,
  warranty = excluded.warranty,
  main_image = excluded.main_image,
  images = excluded.images,
  internal_notes = excluded.internal_notes;

commit;

