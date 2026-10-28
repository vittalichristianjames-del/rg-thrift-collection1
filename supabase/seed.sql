insert into public.products
  (id, title, category, price, size, condition, tag, image, description, measurements, is_featured)
values
  ('p1', 'The Sunday Shirt', 'Tops', 650, 'M', 'Like new', 'JUST FOUND',
   'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=800&q=85',
   'A soft, easy cotton button-down with just the right amount of slouch. Your new every-day, anything-goes shirt.',
   '{"Chest width":"21 in","Length":"27 in","Shoulder width":"18 in","Sleeve":"23 in"}', true),
  ('p2', 'Soft Hours Knit', 'Tops', 780, 'S–M', 'Excellent', 'ONE OF ONE',
   'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=85',
   'A buttery-soft knit in a warm, goes-with-everything neutral. Gently worn and ready for slow mornings.',
   '{"Chest width":"19 in","Length":"23 in","Shoulder width":"16 in","Sleeve":"22 in"}', true),
  ('p3', 'Weekend Denim', 'Bottoms', 920, '28', 'Good vintage', 'GOOD VINTAGE',
   'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=85',
   'Broken-in denim with a straight leg and a little bit of lived-in magic. The kind you keep reaching for.',
   '{"Waist":"28 in","Hip":"38 in","Rise":"11 in","Inseam":"29 in"}', true),
  ('p4', 'Sunday Best Dress', 'Dresses', 1150, 'S', 'Excellent', 'A RARE FIND',
   'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=85',
   'An effortless little dress that can do a coffee date or a dance floor. Lightweight, lovely, and just one.',
   '{"Chest width":"17 in","Length":"44 in","Shoulder width":"14 in","Waist":"15 in"}', true),
  ('p5', 'The Old Favorite', 'Outerwear', 1480, 'M', 'Good vintage', 'ONE LEFT',
   'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=85',
   'A beautifully broken-in layer with lots of life left. Wear it over everything, everywhere.',
   '{"Chest width":"22 in","Length":"25 in","Shoulder width":"19 in","Sleeve":"24 in"}', true),
  ('p6', 'Easy Days Trousers', 'Bottoms', 850, '27', 'Like new', 'JUST FOUND',
   'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=85',
   'Relaxed, roomy trousers with a high rise and a soft drape. A good outfit starts here.',
   '{"Waist":"27 in","Hip":"39 in","Rise":"12 in","Inseam":"28 in"}', true)
on conflict (id) do nothing;
