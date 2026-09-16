-- Per-user isolation: every row belongs to exactly one auth user.
-- The app writes auth.uid() into user_id; anonymous rows (null user_id)
-- stay invisible to everyone.

do $$
declare
  t text;
begin
  foreach t in array array[
    'languages', 'words', 'decks', 'cloze_cards',
    'review_logs', 'stories', 'story_questions', 'story_attempts'
  ]
  loop
    execute format(
      'create policy "Owner full access" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end
$$;
