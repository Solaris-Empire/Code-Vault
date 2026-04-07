-- Atomic stock decrement to prevent race conditions during concurrent checkouts
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INT)
RETURNS void AS $$
  UPDATE products
  SET stock_quantity = GREATEST(stock_quantity - p_quantity, 0),
      updated_at = now()
  WHERE id = p_product_id;
$$ LANGUAGE sql;
