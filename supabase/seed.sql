-- Seed data for local/dev demo of the employee orders dashboard.
-- Safe to run multiple times: uses fixed references and upserts by `reference`.

insert into public.orders (
  reference,
  customer_name,
  customer_email,
  customer_phone,
  items,
  status,
  notes,
  created_at
)
values
  (
    'PED-DEMO01',
    'Marina Souza',
    'marina@example.com',
    '+55 11 99888-1101',
    '[{"name":"X-Burger","quantity":2},{"name":"Batata frita","quantity":1}]'::jsonb,
    'aguardando_confirmacao',
    'Sem cebola em um lanche.',
    now() - interval '45 minutes'
  ),
  (
    'PED-DEMO02',
    'Carlos Lima',
    'carlos@example.com',
    '+55 11 99777-2202',
    '[{"name":"X-Salada","quantity":1},{"name":"Refrigerante lata","quantity":2}]'::jsonb,
    'aguardando_confirmacao',
    null,
    now() - interval '35 minutes'
  ),
  (
    'PED-DEMO03',
    'Patricia Alves',
    'patricia@example.com',
    '+55 11 99666-3303',
    '[{"name":"Duplo bacon","quantity":1},{"name":"Anéis de cebola","quantity":1}]'::jsonb,
    'em_preparo',
    'Molho separado.',
    now() - interval '25 minutes'
  ),
  (
    'PED-DEMO04',
    'João Pedro',
    'joao@example.com',
    '+55 11 99555-4404',
    '[{"name":"Cheeseburger","quantity":3}]'::jsonb,
    'em_preparo',
    null,
    now() - interval '15 minutes'
  ),
  (
    'PED-DEMO05',
    'Fernanda Costa',
    'fernanda@example.com',
    '+55 11 99444-5505',
    '[{"name":"Veggie burger","quantity":1},{"name":"Suco","quantity":1}]'::jsonb,
    'entregue',
    'Entregar na portaria.',
    now() - interval '70 minutes'
  )
on conflict (reference) do update
set
  customer_name = excluded.customer_name,
  customer_email = excluded.customer_email,
  customer_phone = excluded.customer_phone,
  items = excluded.items,
  status = excluded.status,
  notes = excluded.notes,
  created_at = excluded.created_at;
