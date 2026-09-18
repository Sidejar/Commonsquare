-- daily_topic_automation created pg_net without a schema, so it landed in
-- public (security advisor 0014). pg_net is not relocatable: recreate it in
-- `extensions`. Its functions live in the `net` schema either way, so
-- trigger_daily_topic() is unaffected.
-- (Already applied to the CommonSquare project; kept here as the record.)
drop extension if exists pg_net;
create extension pg_net with schema extensions;
