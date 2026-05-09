-- Jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
    job_id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    reward TEXT NOT NULL,
    deadline TEXT,
    client_name TEXT,
    description TEXT NOT NULL,
    requirements TEXT[] DEFAULT '{}',
    attachments JSONB DEFAULT '[]',
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analyzed jobs table
CREATE TABLE IF NOT EXISTS public.analyzed_jobs (
    job_id TEXT PRIMARY KEY REFERENCES public.jobs(job_id),
    banner_size TEXT NOT NULL,
    purpose TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    key_phrases TEXT[] DEFAULT '{}',
    logo_required BOOLEAN DEFAULT FALSE,
    design_tastes TEXT[] DEFAULT '{}',
    forbidden_elements TEXT[] DEFAULT '{}',
    downloaded_assets JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompts table
CREATE TABLE IF NOT EXISTS public.prompts (
    prompt_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES public.jobs(job_id),
    text_prompt TEXT NOT NULL,
    design_taste TEXT NOT NULL,
    gemini_input TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Banners table
CREATE TABLE IF NOT EXISTS public.banners (
    banner_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES public.jobs(job_id),
    prompt_id TEXT NOT NULL REFERENCES public.prompts(prompt_id),
    image_url TEXT NOT NULL,
    design_taste TEXT NOT NULL,
    status TEXT DEFAULT 'generated',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application texts table
CREATE TABLE IF NOT EXISTS public.application_texts (
    application_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES public.jobs(job_id),
    banner_id TEXT NOT NULL REFERENCES public.banners(banner_id),
    text_content TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
