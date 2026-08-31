create or replace function public.apply_dylan_assistant_actions(
  p_user_id uuid,
  p_case_id text,
  p_expected_updated_at timestamptz,
  p_actions jsonb,
  p_original_request text default ''
)
returns table(success boolean, conflict boolean, message text, saved_updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.title_search_cases%rowtype;
  v_payload jsonb;
  v_before jsonb;
  v_action jsonb;
  v_type text;
  v_text text;
  v_details text;
  v_contact text;
  v_owner text;
  v_case_number text;
  v_address text;
  v_now timestamptz := clock_timestamp();
  v_history jsonb;
  v_case_changed boolean := false;
  v_saved_at timestamptz;
  v_due_date date;
  v_due_time time;
  v_due_text text;
  v_priority text;
  v_call_id text;
  v_todo_id uuid;
  v_action_count integer;
begin
  if p_user_id is null or coalesce(p_case_id,'') = '' then
    raise exception 'Missing approved action target';
  end if;

  if jsonb_typeof(p_actions) <> 'array' then
    raise exception 'Actions must be an array';
  end if;
  v_action_count := jsonb_array_length(p_actions);
  if v_action_count < 1 or v_action_count > 10 then
    raise exception 'Approved actions must contain between 1 and 10 items';
  end if;

  select * into v_row
  from public.title_search_cases
  where id = p_case_id
  for update;

  if not found then
    return query select false, false, 'The selected Title Search case no longer exists.', null::timestamptz;
    return;
  end if;

  if p_expected_updated_at is null or v_row.updated_at <> p_expected_updated_at then
    return query select false, true, 'This file changed after the proposal was prepared. Reload it and review the update again.', v_row.updated_at;
    return;
  end if;

  v_payload := coalesce(v_row.payload, '{}'::jsonb);
  v_before := v_payload;
  v_case_number := coalesce(nullif(v_row.case_number,''), nullif(v_payload->>'number',''), nullif(v_payload->>'caseNumber',''), '');
  v_address := coalesce(v_payload->>'address','');
  v_history := case when jsonb_typeof(v_payload->'history')='array' then v_payload->'history' else '[]'::jsonb end;

  for v_action in select value from jsonb_array_elements(p_actions)
  loop
    v_type := lower(coalesce(v_action->>'action_type',''));
    v_text := btrim(coalesce(v_action->>'text',''));
    v_details := btrim(coalesce(v_action->>'details',''));
    v_contact := btrim(coalesce(v_action->>'contact_name',''));
    v_owner := btrim(coalesce(v_action->>'owner',''));
    if v_owner = '' then v_owner := 'Dylan'; end if;
    v_due_text := left(btrim(coalesce(v_action->>'due_text','')), 200);
    v_priority := lower(coalesce(v_action->>'priority','normal'));
    if v_priority not in ('low','normal','high') then v_priority := 'normal'; end if;
    v_due_date := null;
    v_due_time := null;
    if coalesce(v_action->>'due_date','') ~ '^\d{4}-\d{2}-\d{2}$' then
      begin v_due_date := (v_action->>'due_date')::date; exception when others then v_due_date := null; end;
    end if;
    if coalesce(v_action->>'due_time','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      begin v_due_time := (v_action->>'due_time')::time; exception when others then v_due_time := null; end;
    end if;

    if v_type = 'add_case_note' then
      if v_text = '' then raise exception 'Case note text is required'; end if;
      v_text := left(v_text, 4000);
      v_payload := jsonb_set(v_payload, '{notes}', to_jsonb(case when coalesce(v_payload->>'notes','')='' then v_text else (v_payload->>'notes') || E'\n\n' || v_text end), true);
      v_history := v_history || jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'at',v_now,'by','dylan.sprouse@unifiedtitle.net','text','Dylan Assistant approved case note: ' || left(v_text,500)));
      v_case_changed := true;

    elsif v_type = 'update_next_step' then
      if v_text = '' then raise exception 'Next-step text is required'; end if;
      v_text := left(v_text, 1000);
      v_payload := jsonb_set(v_payload, '{nextAction}', to_jsonb(v_text), true);
      v_history := v_history || jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'at',v_now,'by','dylan.sprouse@unifiedtitle.net','text','Dylan Assistant updated next step: ' || left(v_text,500)));
      v_case_changed := true;

    elsif v_type = 'create_todo' then
      if v_text = '' then raise exception 'To-do text is required'; end if;
      v_todo_id := gen_random_uuid();
      insert into public.dylan_voice_todos(id,user_id,title,details,due_date,due_time,due_text,priority,completed,original_request,created_at,updated_at,deleted_at)
      values(v_todo_id,p_user_id,left(v_text,500),nullif(left(v_details,4000),''),v_due_date,v_due_time,nullif(v_due_text,''),v_priority,false,left(coalesce(p_original_request,''),8000),v_now,v_now,null);

    elsif v_type = 'create_callback' then
      if v_text = '' then raise exception 'Callback next action is required'; end if;
      if v_contact = '' then raise exception 'Callback contact is required'; end if;
      v_call_id := gen_random_uuid()::text;
      insert into public.dylan_call_records(id,user_id,payload,created_at,updated_at,deleted_at)
      values(
        v_call_id,
        p_user_id,
        jsonb_build_object(
          'schemaVersion',2,'id',v_call_id,'direction','Outgoing','caller',left(v_contact,300),'phone','','companyRole','',
          'fileNumber',v_case_number,'address',v_address,'subject',coalesce(nullif(left(v_details,500),''),'Assistant-created callback'),
          'outcome','','results','','advised','','followUp',true,'followType','Callback','status','Open','previousStatus','Open',
          'owner',left(v_owner,200),'waitingOn','','dueDate',coalesce(v_due_date::text,''),
          'todos',jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'text',left(v_text,1000),'completed',false,'createdAt',v_now,'completedAt','')),
          'createdAt',v_now,'updatedAt',v_now,'completedAt','','history','[]'::jsonb,
          'reason',coalesce(nullif(left(v_details,500),''),'Assistant-created callback'),'issueType',coalesce(nullif(left(v_details,500),''),'Assistant-created callback'),
          'notes','','outcomeNotes','','promise','','result','','followStatus','Open','category','Callback','followUpType','Callback',
          'assignedTo',left(v_owner,200),'otherOwner',(lower(v_owner) <> 'dylan'),'followUpDate',coalesce(v_due_date::text,''),
          'task',left(v_text,1000),'nextAction',left(v_text,1000),'callbackRequired',(lower(v_owner)='dylan')
        ),
        v_now,v_now,null
      );

    else
      raise exception 'Unsupported approved action type: %', v_type;
    end if;
  end loop;

  if v_case_changed then
    v_payload := jsonb_set(v_payload, '{history}', v_history, true);
    v_payload := jsonb_set(v_payload, '{lastUpdated}', to_jsonb(v_now::text), true);
    v_payload := jsonb_set(v_payload, '{lastTouchedAt}', to_jsonb(v_now::text), true);
    v_payload := jsonb_set(v_payload, '{lastTouchedBy}', to_jsonb('dylan.sprouse@unifiedtitle.net'::text), true);
    update public.title_search_cases
      set payload = v_payload,
          updated_at = v_now,
          updated_by = 'dylan.sprouse@unifiedtitle.net'
      where id = p_case_id and updated_at = p_expected_updated_at;
    if not found then
      raise exception 'Concurrent Title Search update detected';
    end if;
    v_saved_at := v_now;
  else
    v_saved_at := v_row.updated_at;
  end if;

  for v_action in select value from jsonb_array_elements(p_actions)
  loop
    insert into public.dylan_assistant_action_audit(user_id,case_id,case_number,action_type,approved_payload,before_data,after_data,created_at)
    values(p_user_id,p_case_id,v_case_number,coalesce(v_action->>'action_type','unknown'),v_action || jsonb_build_object('original_request',left(coalesce(p_original_request,''),8000)),v_before,v_payload,v_now);
  end loop;

  return query select true, false, 'Approved changes were saved.', v_saved_at;
end;
$$;

revoke all on function public.apply_dylan_assistant_actions(uuid,text,timestamptz,jsonb,text) from public;
revoke all on function public.apply_dylan_assistant_actions(uuid,text,timestamptz,jsonb,text) from anon;
revoke all on function public.apply_dylan_assistant_actions(uuid,text,timestamptz,jsonb,text) from authenticated;
grant execute on function public.apply_dylan_assistant_actions(uuid,text,timestamptz,jsonb,text) to service_role;
