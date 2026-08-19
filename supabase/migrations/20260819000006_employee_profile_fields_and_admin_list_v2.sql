ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS qualification text;

ALTER TABLE public.employees DROP COLUMN IF EXISTS card_number;

DROP FUNCTION IF EXISTS public.admin_save_employee(uuid,text,text,text,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.admin_save_employee(
  p_id uuid DEFAULT NULL,
  p_employee_id text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_qualification text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_branch text DEFAULT NULL,
  p_job_title text DEFAULT NULL,
  p_status text DEFAULT 'active'
)
RETURNS public.employees
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.employees; v_user_id uuid; v_status public.entity_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can manage employees'; END IF;
  IF nullif(trim(coalesce(p_employee_id,'')),'') IS NULL THEN RAISE EXCEPTION 'Employee ID is required'; END IF;
  IF nullif(trim(coalesce(p_full_name,'')),'') IS NULL THEN RAISE EXCEPTION 'Full name is required'; END IF;
  v_status := coalesce(nullif(lower(trim(p_status)),''),'active')::public.entity_status;
  IF nullif(trim(coalesce(p_email,'')),'') IS NOT NULL THEN
    SELECT u.id INTO v_user_id FROM auth.users u WHERE lower(u.email)=lower(trim(p_email)) ORDER BY u.created_at DESC LIMIT 1;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.employees(employee_id,full_name,birth_date,qualification,national_id,email,phone,branch,job_title,status,user_id,updated_at)
    VALUES(trim(p_employee_id),trim(p_full_name),p_birth_date,nullif(trim(coalesce(p_qualification,'')),''),nullif(trim(coalesce(p_national_id,'')),''),nullif(lower(trim(coalesce(p_email,''))),''),nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_branch,'')),''),nullif(trim(coalesce(p_job_title,'')),''),v_status,v_user_id,now()) RETURNING * INTO result;
  ELSE
    UPDATE public.employees SET employee_id=trim(p_employee_id),full_name=trim(p_full_name),birth_date=p_birth_date,qualification=nullif(trim(coalesce(p_qualification,'')),''),national_id=nullif(trim(coalesce(p_national_id,'')),''),email=nullif(lower(trim(coalesce(p_email,''))),''),phone=nullif(trim(coalesce(p_phone,'')),''),branch=nullif(trim(coalesce(p_branch,'')),''),job_title=nullif(trim(coalesce(p_job_title,'')),''),status=v_status,user_id=coalesce(v_user_id,user_id),updated_at=now() WHERE id=p_id RETURNING * INTO result;
    IF NOT found THEN RAISE EXCEPTION 'Employee not found'; END IF;
  END IF;
  IF result.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id,role) VALUES(result.user_id,'employee'::public.app_role) ON CONFLICT(user_id,role) DO NOTHING;
    UPDATE public.profiles SET full_name=result.full_name,email=result.email,phone=result.phone,role='employee',updated_at=now() WHERE id=result.user_id;
  END IF;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_save_employee(uuid,text,text,date,text,text,text,text,text,text,text) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_list_employees();
CREATE FUNCTION public.admin_list_employees()
RETURNS SETOF public.employees
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.* FROM public.employees e
  WHERE public.has_role(auth.uid(),'admin'::public.app_role)
  ORDER BY e.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_employees() TO authenticated;

DROP FUNCTION IF EXISTS public.get_my_employee();
CREATE FUNCTION public.get_my_employee()
RETURNS TABLE(employee_id text,birth_date date,qualification text,national_id text,job_title text,branch text,full_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
 SELECT e.employee_id,e.birth_date,e.qualification,e.national_id,e.job_title,e.branch,e.full_name
 FROM public.employees e
 WHERE e.user_id=auth.uid() OR lower(coalesce(e.email,''))=lower(coalesce(auth.jwt()->>'email',''))
 ORDER BY e.updated_at DESC NULLS LAST LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_employee() TO authenticated;
