/*
# Let clients cancel their own pending orders through a server-checked function

1. Changes
- New function `client_cancel_orders(p_order_ids uuid[])`.
- Sets status to 'cancelled' only for rows that belong to the calling client and are still 'pending'.
- Returns how many orders were cancelled, so the app can tell whether the cancel really happened.

2. Security
- SECURITY DEFINER with a fixed search_path.
- Ownership is taken from the session (auth.uid()), never from a client-supplied id.
- EXECUTE revoked from PUBLIC and anon; granted only to authenticated.

3. Notes
- Orders already being processed or completed cannot be cancelled by the client.
- The admin sees the cancelled status in the orders list immediately.
*/

CREATE OR REPLACE FUNCTION public.client_cancel_orders(p_order_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE orders
  SET status = 'cancelled'
  WHERE id = ANY(p_order_ids)
    AND client_id = auth.uid()
    AND status = 'pending';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_cancel_orders(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_cancel_orders(uuid[]) TO authenticated;
