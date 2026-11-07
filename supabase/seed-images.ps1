$ErrorActionPreference = 'Stop'

# Upload the bundled seed logo and cover images to the linked Supabase project.
# Review the linked project before running; this writes to Supabase Storage.
$objects = @(
  @{ File = 'seed-assets/org-covers/a0000000-0000-4000-8000-000000000001/054cd7a1-1eb0-49e5-8770-23550f5446b7/seed-cover.jpg'; Remote = 'ss:///org-covers/a0000000-0000-4000-8000-000000000001/054cd7a1-1eb0-49e5-8770-23550f5446b7/seed-cover.jpg' },
  @{ File = 'seed-assets/org-covers/a0000000-0000-4000-8000-000000000002/32c76857-7457-4265-a753-49cc1a9d933f/seed-cover.jpg'; Remote = 'ss:///org-covers/a0000000-0000-4000-8000-000000000002/32c76857-7457-4265-a753-49cc1a9d933f/seed-cover.jpg' },
  @{ File = 'seed-assets/org-covers/a0000000-0000-4000-8000-000000000003/374c697b-8b73-4b5f-962f-46e81afea32b/seed-cover.jpg'; Remote = 'ss:///org-covers/a0000000-0000-4000-8000-000000000003/374c697b-8b73-4b5f-962f-46e81afea32b/seed-cover.jpg' },
  @{ File = 'seed-assets/org-covers/a0000000-0000-4000-8000-000000000004/99e3cedc-707c-4624-8009-d312c8f84f41/seed-cover.jpg'; Remote = 'ss:///org-covers/a0000000-0000-4000-8000-000000000004/99e3cedc-707c-4624-8009-d312c8f84f41/seed-cover.jpg' },
  @{ File = 'seed-assets/org-logos/a0000000-0000-4000-8000-000000000001/054cd7a1-1eb0-49e5-8770-23550f5446b7/seed-logo.jpg'; Remote = 'ss:///org-logos/a0000000-0000-4000-8000-000000000001/054cd7a1-1eb0-49e5-8770-23550f5446b7/seed-logo.jpg' },
  @{ File = 'seed-assets/org-logos/a0000000-0000-4000-8000-000000000002/32c76857-7457-4265-a753-49cc1a9d933f/seed-logo.jpg'; Remote = 'ss:///org-logos/a0000000-0000-4000-8000-000000000002/32c76857-7457-4265-a753-49cc1a9d933f/seed-logo.jpg' },
  @{ File = 'seed-assets/org-logos/a0000000-0000-4000-8000-000000000003/374c697b-8b73-4b5f-962f-46e81afea32b/seed-logo.jpg'; Remote = 'ss:///org-logos/a0000000-0000-4000-8000-000000000003/374c697b-8b73-4b5f-962f-46e81afea32b/seed-logo.jpg' },
  @{ File = 'seed-assets/org-logos/a0000000-0000-4000-8000-000000000004/99e3cedc-707c-4624-8009-d312c8f84f41/seed-logo.jpg'; Remote = 'ss:///org-logos/a0000000-0000-4000-8000-000000000004/99e3cedc-707c-4624-8009-d312c8f84f41/seed-logo.jpg' }
)

foreach ($object in $objects) {
  $source = Join-Path $PSScriptRoot $object.File
  & npx supabase --experimental storage cp --remote $source $object.Remote --content-type image/jpeg --cache-control 'public, max-age=31536000, immutable'
  if ($LASTEXITCODE -ne 0) { throw "Image upload failed: $source" }
}
