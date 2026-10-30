import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ImportWizard } from '@/components/admin/ImportWizard';
import { requireAdminPage } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { firstParam } from '@/lib/validation/species';
import { getSpeciesForEdit, listAllGroups } from '@/services/species.service';

export const metadata: Metadata = { title: 'Importar dados taxonômicos' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ImportPage({ searchParams }: { searchParams: SearchParams }) {
  const speciesParam = firstParam((await searchParams).especie);
  const path = speciesParam
    ? `/admin/especies/importar?especie=${encodeURIComponent(speciesParam)}`
    : '/admin/especies/importar';
  const { client } = await requireAdminPage(path);

  let target: { id: string; commonName: string; scientificName: string } | null = null;
  if (speciesParam) {
    if (!isUuid(speciesParam)) notFound();
    const species = await getSpeciesForEdit(client, speciesParam);
    if (!species.ok) throw new Error('Falha ao carregar a espécie.');
    if (!species.data) notFound();
    target = {
      id: species.data.id,
      commonName: species.data.commonName,
      scientificName: species.data.scientificName,
    };
  }
  const groups = await listAllGroups(client);

  return (
    <>
      <p className="breadcrumb">
        <Link href="/admin/especies">Espécies</Link>
        {target ? (
          <>
            {' / '}
            <Link href={`/admin/especies/${target.id}`}>{target.commonName}</Link>
          </>
        ) : null}
        {' / '}Importar dados taxonômicos
      </p>
      <h1>Importar dados taxonômicos</h1>
      <p className="admin-muted">
        Pesquise no WoRMS (World Register of Marine Species) e, se quiser, no GBIF. Os dados vêm
        apenas para revisão: nada é publicado automaticamente e só são sugeridos os campos que a
        fonte realmente fornece (nome científico, classificação, nome popular em português quando
        existir e identificadores). Dieta, habitat, comportamento e conservação continuam sendo
        preenchidos pela equipe, com fonte.
      </p>
      {target ? (
        <p className="admin-flash admin-flash--info">
          Importando para <strong>{target.commonName}</strong> (
          <span className="scientific-name">{target.scientificName}</span>). Campos já preenchidos
          só serão substituídos se você confirmar.
        </p>
      ) : null}
      <ImportWizard
        target={target}
        initialTerm={target?.scientificName ?? ''}
        groups={groups.ok ? groups.data : []}
      />
    </>
  );
}
