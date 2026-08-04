-- All active property bank accounts are offered for every online booking.
-- Preserve the exact version choices per reservation without duplicating
-- decrypted account numbers into transactional tables.

create table if not exists reservation_payment_instructions (
  reservation_id uuid not null
    references reservations(id) on delete restrict,
  payment_instruction_version_id uuid not null
    references payment_instruction_versions(id) on delete restrict,
  display_order integer not null,
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  constraint reservation_payment_instructions_pkey primary key (
    reservation_id,
    payment_instruction_version_id
  ),
  constraint uq_reservation_payment_instruction_order unique (
    reservation_id,
    display_order
  ),
  constraint ck_reservation_payment_instruction_order check (
    display_order > 0
  )
);

-- Retain the historical single-bank snapshot for bookings created before this
-- migration. New reservations insert every active account into the table.
insert into reservation_payment_instructions (
  reservation_id,
  payment_instruction_version_id,
  display_order,
  created_by_user_id
)
select
  id,
  payment_instruction_version_id,
  1,
  created_by_user_id
from reservations
where payment_instruction_version_id is not null
on conflict do nothing;

create index if not exists ix_reservation_payment_instructions_version
  on reservation_payment_instructions (payment_instruction_version_id);
