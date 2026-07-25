import { SearchBar } from '@/components/SearchBar';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-reader py-8">
      <h1 className="text-[24px] font-semibold text-ink">Not found</h1>
      <p className="mb-8 mt-2 text-[16px] text-ink2">
        That address does not resolve to a surah, verse or range. Search the corpus instead.
      </p>
      <SearchBar />
    </div>
  );
}
