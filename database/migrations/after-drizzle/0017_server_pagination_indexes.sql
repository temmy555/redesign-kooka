create index if not exists ix_reservations_property_created
  on reservations (property_id, created_at desc);

create index if not exists ix_payments_created
  on payments (created_at desc);

create index if not exists ix_audit_property_created
  on audit_events (property_id, created_at desc);
