-- Atomic gift card redemption function.
-- Deducts the balance in a single UPDATE with a WHERE guard,
-- preventing double-spend race conditions between concurrent requests.
CREATE OR REPLACE FUNCTION redeem_gift_card_balance(
  card_id UUID,
  redeem_amount INTEGER
)
RETURNS SETOF gift_cards
LANGUAGE sql
AS $$
  UPDATE gift_cards
  SET
    current_balance_pence = current_balance_pence - redeem_amount,
    status = CASE WHEN current_balance_pence - redeem_amount = 0 THEN 'used' ELSE 'active' END,
    updated_at = now()
  WHERE id = card_id
    AND current_balance_pence >= redeem_amount
  RETURNING *;
$$;
