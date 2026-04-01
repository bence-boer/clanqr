-- Prevent invite tokens from being reused via database-level trigger.
-- Belt-and-suspenders protection: the application layer uses optimistic locking
-- (UPDATE ... WHERE used_by IS NULL), but this trigger catches any edge case.

CREATE OR REPLACE FUNCTION enforce_invite_single_use()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.used_by IS NOT NULL AND NEW.used_by IS DISTINCT FROM OLD.used_by THEN
        RAISE EXCEPTION 'invite token already used'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invite_single_use
    BEFORE UPDATE ON invite_tokens
    FOR EACH ROW
    WHEN (NEW.used_by IS NOT NULL)
    EXECUTE FUNCTION enforce_invite_single_use();
