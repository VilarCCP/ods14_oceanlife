import { MAX_SEARCH_TERM_LENGTH } from '@/lib/text';

interface SearchFormProps {
  /** Termo atual, para manter o campo preenchido após pesquisar. */
  defaultValue?: string;
  /** Grupo atualmente filtrado, preservado na nova pesquisa. */
  group?: string;
  id?: string;
}

/**
 * Pesquisa por nome popular ou científico. É um formulário GET comum: funciona
 * sem JavaScript e o termo fica na URL (/especies?q=...), podendo ser
 * compartilhado e recarregado (doc 02 §6.2).
 */
export function SearchForm({ defaultValue = '', group, id = 'pesquisa' }: SearchFormProps) {
  const hintId = `${id}-dica`;
  return (
    <form className="search-form" action="/especies" method="get" role="search">
      <label className="search-form__label" htmlFor={id}>
        Pesquisar espécies
      </label>
      <p className="search-form__hint" id={hintId}>
        Digite o nome popular ou o nome científico. Acentos e maiúsculas não importam.
      </p>
      <div className="search-form__row">
        <input
          className="search-form__input"
          id={id}
          name="q"
          type="search"
          defaultValue={defaultValue}
          maxLength={MAX_SEARCH_TERM_LENGTH}
          placeholder="Ex.: tartaruga ou Chelonia"
          aria-describedby={hintId}
          autoComplete="off"
        />
        {group ? <input type="hidden" name="grupo" value={group} /> : null}
        <button className="button" type="submit">
          Pesquisar
        </button>
      </div>
    </form>
  );
}
