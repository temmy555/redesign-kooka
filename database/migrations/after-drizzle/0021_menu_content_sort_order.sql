DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'menu_categories'
      AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE menu_categories ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'menu_items'
      AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_menu_categories_sort_order
  ON menu_categories (sort_order);

CREATE INDEX IF NOT EXISTS ix_menu_items_sort_order
  ON menu_items (sort_order);
