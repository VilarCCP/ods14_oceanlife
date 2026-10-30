import type { Metadata } from 'next';
import Link from 'next/link';

import { SpeciesForm } from '@/components/admin/SpeciesForm';
import { emptySpeciesFormValues } from '@/components/admin/species-form-fields';
import { requireAdminPage } from '@/lib/auth';
import { listAllGroups } from '@/services/species.service';

export const metadata: Metadata = { title: 'Cadastrar espécie' };

export default async function NewSpeciesPage() {
  const { client } = await requireAdminPage('/admin/especies/nova');
  const groups = await listAllGroups(client);

  return (
    <>
      <p className="breadcrumb">
        <Link href="/admin/especies">Espécies</Link> / Cadastrar
      </p>
      <h1>Cadastrar espécie</h1>
      <p className="admin-muted">
        A espécie será salva como rascunho. Depois de salvar, você poderá adicionar imagens, fontes
        e publicá-la.
      </p>
      {!groups.ok ? (
        <p className="admin-flash admin-flash--error" role="alert">
          Não foi possível carregar a lista de grupos. Você ainda pode salvar sem grupo.
        </p>
      ) : null}
      <SpeciesForm
        mode="create"
        initialValues={emptySpeciesFormValues()}
        groups={groups.ok ? groups.data : []}
      />
    </>
  );
}
