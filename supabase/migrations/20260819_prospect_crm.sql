-- Mini-CRM prospection (OT / collectivités / partenaires) — console admin.
-- Shared by all moderators. Not a Pass IRL partner, not a Diffuseur org.

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(auth.jwt()->'app_metadata'->>'role', auth.jwt()->>'role') IN ('moderateur', 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('moderateur', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.prospect_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  segment text NOT NULL CHECK (
    segment IN ('office_tourisme', 'collectivite', 'association', 'partenaire', 'lieu')
  ),
  region text NOT NULL DEFAULT 'Grand Est',
  department_code text NOT NULL DEFAULT '57',
  department_name text NOT NULL DEFAULT 'Moselle',
  city text,
  email text,
  phone text,
  website text,
  contact_name text,
  status text NOT NULL DEFAULT 'sourced' CHECK (
    status IN (
      'sourced', 'enriched', 'draft_ready', 'queued', 'sent',
      'warming', 'replied', 'won', 'cold', 'dead'
    )
  ),
  heat text NOT NULL DEFAULT 'none' CHECK (
    heat IN ('none', 'hot', 'warm', 'cold', 'dead')
  ),
  source text,
  source_url text,
  notes text,
  last_contacted_at timestamptz,
  next_action_at timestamptz,
  next_action text,
  email_verified boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS prospect_leads_org_uniq
  ON public.prospect_leads (department_code, segment, name);

CREATE INDEX IF NOT EXISTS prospect_leads_segment_status_idx
  ON public.prospect_leads (department_code, segment, status);

CREATE INDEX IF NOT EXISTS prospect_leads_heat_idx
  ON public.prospect_leads (heat)
  WHERE heat IN ('hot', 'warm');

COMMENT ON TABLE public.prospect_leads IS
  'Outbound prospecting CRM for Web Console. Professional/public org contacts only.';

CREATE TABLE IF NOT EXISTS public.prospect_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.prospect_leads (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (
    type IN ('note', 'email_out', 'email_in', 'call', 'status_change', 'heat_change')
  ),
  subject text,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prospect_activities_lead_created_idx
  ON public.prospect_activities (lead_id, created_at DESC);

COMMENT ON TABLE public.prospect_activities IS
  'Timeline for a prospect lead: notes, outbound/inbound, status/heat changes.';

DROP TRIGGER IF EXISTS prospect_leads_set_updated_at ON public.prospect_leads;
CREATE TRIGGER prospect_leads_set_updated_at
  BEFORE UPDATE ON public.prospect_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.prospect_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospect_leads_moderator_all ON public.prospect_leads;
CREATE POLICY prospect_leads_moderator_all
  ON public.prospect_leads
  FOR ALL
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS prospect_activities_moderator_all ON public.prospect_activities;
CREATE POLICY prospect_activities_moderator_all
  ON public.prospect_activities
  FOR ALL
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

REVOKE ALL ON public.prospect_leads FROM PUBLIC, anon;
REVOKE ALL ON public.prospect_activities FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_activities TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed Moselle (57) — public professional contacts from official pages.
-- email_verified = true only when the address is published on the source_url.
-- ---------------------------------------------------------------------------
INSERT INTO public.prospect_leads (
  name, segment, city, email, phone, website, source, source_url, email_verified, notes
) VALUES
  (
    'Moselle Attractivité',
    'office_tourisme',
    'Metz',
    'contact@moselle-attractivite.fr',
    '03 87 37 57 80',
    'https://mosl.fr/',
    'Site / blog MOSL',
    'https://www.blog.mosl.fr/',
    true,
    'ADT / agence départementale. Point d’entrée OT Moselle.'
  ),
  (
    'Agence Inspire Metz — Office de Tourisme',
    'office_tourisme',
    'Metz',
    'tourisme@inspire-metz.com',
    '03 87 39 00 00',
    'https://www.tourisme-metz.com/',
    'Page contact officielle',
    'https://www.tourisme-metz.com/fr/preparer-son-sejour/contact',
    true,
    NULL
  ),
  (
    'Pays Thionvillois Tourisme',
    'office_tourisme',
    'Thionville',
    'tourisme@thionville.net',
    '03 82 53 33 18',
    'https://www.thionvilletourisme.fr/',
    'Guide démarches Ville de Thionville',
    'https://www.thionville.fr/',
    true,
    '31 place Anne Grommerch.'
  ),
  (
    'Office de Tourisme du Pays de Bitche',
    'office_tourisme',
    'Bitche',
    'contact@tourisme-paysdebitche.fr',
    '03 87 06 16 16',
    'https://www.tourisme-paysdebitche.fr/',
    'CC Pays de Bitche',
    'https://www.cc-paysdebitche.fr/tourisme-culture-sport/loffice-de-tourisme/',
    true,
    NULL
  ),
  (
    'Office de Tourisme Sarreguemines Confluences',
    'office_tourisme',
    'Sarreguemines',
    'contact@sarreguemines-tourisme.com',
    '03 87 98 80 81',
    'https://www.sarreguemines-tourisme.com/',
    'Page contact OT',
    'https://www.sarreguemines-tourisme.com/contact/',
    true,
    NULL
  ),
  (
    'Tourisme Sarrebourg Moselle Sud',
    'office_tourisme',
    'Sarrebourg',
    'contact@tourisme-sarrebourg.fr',
    '03 87 03 11 82',
    'https://www.tourisme-sarrebourg.fr/',
    'Ville de Sarrebourg + mentions légales OT',
    'https://www.sarrebourg.fr/plan/office-du-tourisme/',
    true,
    NULL
  ),
  (
    'Office de tourisme de Saint-Avold Cœur de Moselle',
    'office_tourisme',
    'Saint-Avold',
    'contact@tourisme-saint-avold.fr',
    '03 87 91 30 19',
    'https://www.saintavold-coeurdemoselle.fr/',
    'Page contact OT',
    'https://www.saintavold-coeurdemoselle.fr/contactez-nous/',
    true,
    NULL
  ),
  (
    'Office de Tourisme du Pays de Forbach',
    'office_tourisme',
    'Forbach',
    'contact@paysdeforbach.com',
    '03 87 85 02 43',
    'https://paysdeforbach.com/',
    'Page contact OT',
    'https://paysdeforbach.com/nous-rencontrer/contact/',
    true,
    'Email général publié sur la page contact. 1er envoi à valider humainement (OT).'
  ),
  (
    'Office de Tourisme du Pays du Saulnois',
    'office_tourisme',
    'Château-Salins',
    'contact@tourisme-saulnois.com',
    '03 87 01 16 26',
    'https://www.tourisme-saulnois.com/',
    'Fiche MOSL',
    'https://www.mosl.fr/fr/offices-de-tourisme/f854000738_office-de-tourisme-du-pays-du-saulnois-chateau-salins',
    true,
    NULL
  ),
  (
    'Trois Frontières Tourisme',
    'office_tourisme',
    'Sierck-les-Bains',
    'officedetourisme@ccb3f.fr',
    '03 82 83 74 14',
    'https://www.troisfrontierestourisme.com/',
    'Mairie de Sierck-les-Bains',
    'https://www.siercklesbains.fr/site-mairie/tourisme-patrimoine-et-hebergements/office-de-tourisme.html',
    true,
    NULL
  ),
  (
    'Office de Tourisme Intercommunal du Pays de Phalsbourg',
    'office_tourisme',
    'Phalsbourg',
    'tourisme@paysdephalsbourg.fr',
    '03 87 24 42 42',
    'https://www.paysdephalsbourg.com/',
    'Fiche MOSL',
    'https://www.mosl.fr/fr/offices-de-tourisme/f847000518_office-de-tourisme-du-pays-de-phalsbourg-site-de-phalsbourg-phalsbourg',
    true,
    'Email reconfirmé sur la fiche MOSL actuelle. 1er envoi à valider humainement (OT).'
  ),
  (
    'Destination Amnéville — Office de Tourisme',
    'office_tourisme',
    'Amnéville',
    'accueil@destination-amneville.com',
    '03 87 70 10 40',
    'https://amneville.com/',
    'Fiche MOSL',
    'https://www.mosl.fr/fr/offices-de-tourisme/f1368000211_destination-amneville-amneville-les-thermes',
    true,
    'Email publié sur la fiche MOSL. 1er envoi à valider humainement (OT).'
  ),
  (
    'Office de tourisme de Cattenom et Environs',
    'office_tourisme',
    'Rodemack',
    'otcommunautaire@cc-ce.com',
    '03 82 56 00 02',
    'https://www.tourisme-ccce.fr',
    'Fiche MOSL',
    'https://www.mosl.fr/fr/offices-de-tourisme/f1371000153_office-de-tourisme-de-cattenom-et-environs-rodemack',
    true,
    'Email publié sur la fiche MOSL. 1er envoi à valider humainement (OT).'
  ),
  (
    'Office de tourisme Connexion Freyming-Merlebach',
    'office_tourisme',
    'Hombourg-Haut',
    'accueil@tourismefreyming-merlebach.fr',
    '03 87 90 53 53',
    'https://tourismefreyming-merlebach.fr/',
    'Fiche MOSL + page contact OT',
    'https://tourismefreyming-merlebach.fr/contact/',
    true,
    'Email publié sur MOSL et sur la page contact OT. 1er envoi à valider humainement (OT).'
  ),
  (
    'Mairie de Metz',
    'collectivite',
    'Metz',
    'contact@metz.fr',
    '08 00 89 18 91',
    'https://metz.fr/',
    'Annuaire service-public.gouv.fr',
    'https://lannuaire.service-public.gouv.fr/grand-est/moselle/eb514eda-5901-473d-902d-c7806cebd720',
    true,
    '1er envoi à valider humainement (collectivité).'
  ),
  (
    'Mairie de Thionville',
    'collectivite',
    'Thionville',
    'contact@mairie-thionville.fr',
    '03 82 82 25 25',
    'https://www.thionville.fr/',
    'Annuaire service-public.gouv.fr',
    'https://lannuaire.service-public.gouv.fr/grand-est/moselle/ab00d7b5-d02a-43d4-804d-21bb04e49b73',
    true,
    '1er envoi à valider humainement (collectivité).'
  ),
  (
    'Mairie de Forbach',
    'collectivite',
    'Forbach',
    'contact@mairie-forbach.fr',
    '03 87 84 30 00',
    'https://www.mairie-forbach.fr/',
    'Annuaire service-public.gouv.fr',
    'https://lannuaire.service-public.gouv.fr/grand-est/moselle/75206b5d-c91f-40ff-b690-805f2dcf0cec',
    true,
    '1er envoi à valider humainement (collectivité).'
  ),
  (
    'Centre Pompidou-Metz',
    'lieu',
    'Metz',
    NULL,
    NULL,
    'https://www.centrepompidou-metz.fr/',
    'Site institutionnel',
    'https://www.centrepompidou-metz.fr/',
    false,
    'Partenaire culturel potentiel. Email service groupes / communication à enrichir.'
  ),
  (
    'Arsenal — Metz',
    'lieu',
    'Metz',
    NULL,
    NULL,
    'https://arsenal-metz.fr/',
    'Site salle',
    'https://arsenal-metz.fr/',
    false,
    'Lieu / programmation. Contact à enrichir.'
  )
ON CONFLICT (department_code, segment, name) DO NOTHING;
