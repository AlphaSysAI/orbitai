// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Loader2, MapPin } from "lucide-react";

export type AddressSelection = {
  label: string;
  city: string | null;
  lat: number;
  lon: number;
};

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (selection: AddressSelection) => void;
  disabled?: boolean;
  placeholder?: string;
  searchEndpoint?: string;
  /** True quand lat/lon proviennent d'une sélection validée */
  locationConfirmed?: boolean;
  lat?: number;
  lon?: number;
};

type Suggestion = AddressSelection & { postcode: string | null };

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  disabled = false,
  placeholder = "Commencez à saisir l'adresse de l'aire…",
  searchEndpoint = "/api/regiaire/address-search",
  locationConfirmed = false,
  lat,
  lon,
}: AddressAutocompleteProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (value.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: value.trim() });
        const response = await fetch(`${searchEndpoint}?${params}`);
        if (!response.ok) {
          setSearchError("Recherche indisponible");
          setSuggestions([]);
          return;
        }
        const data = (await response.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setHighlightIndex(-1);
      } catch {
        setSearchError("Erreur réseau");
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [value, searchEndpoint]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pickSuggestion = useCallback(
    (suggestion: Suggestion) => {
      onChange(suggestion.label);
      onSelect({
        label: suggestion.label,
        city: suggestion.city,
        lat: suggestion.lat,
        lon: suggestion.lon,
      });
      setSuggestions([]);
      setIsOpen(false);
      setHighlightIndex(-1);
    },
    [onChange, onSelect]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (event.key === "Enter" && highlightIndex >= 0) {
      event.preventDefault();
      const picked = suggestions[highlightIndex];
      if (picked) pickSuggestion(picked);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setHighlightIndex(-1);
    }
  };

  const showDropdown =
    isOpen && value.trim().length >= 3 && !disabled;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (value.trim().length >= 3) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-10 text-white placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
        />
        {isSearching && (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-amber-400"
          />
        )}
      </div>

      {locationConfirmed && lat != null && lon != null && (
        <p className="mt-2 text-[11px] text-emerald-400/90">
          Localisation confirmée · {lat.toFixed(5)}, {lon.toFixed(5)}
        </p>
      )}

      {!locationConfirmed && value.trim().length > 0 && (
        <p className="mt-2 text-[11px] text-amber-400/80">
          Sélectionnez une adresse dans la liste pour valider la localisation.
        </p>
      )}

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 py-1 shadow-xl"
        >
          {isSearching && suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">Recherche…</li>
          )}

          {!isSearching && searchError && (
            <li className="px-4 py-3 text-sm text-red-400">{searchError}</li>
          )}

          {!isSearching &&
            !searchError &&
            suggestions.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-500">
                Aucune adresse trouvée — affinez la saisie
              </li>
            )}

          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.label}-${index}`} role="option">
              <button
                type="button"
                aria-selected={index === highlightIndex}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => pickSuggestion(suggestion)}
                className={`flex w-full items-start gap-2 px-4 py-3 text-left text-sm transition-colors ${
                  index === highlightIndex
                    ? "bg-amber-600/20 text-white"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                <MapPin
                  size={14}
                  className="mt-0.5 shrink-0 text-amber-500/80"
                />
                <span>
                  {suggestion.label}
                  {suggestion.postcode && (
                    <span className="ml-1 text-slate-500">
                      ({suggestion.postcode})
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
