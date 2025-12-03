import { useState, useCallback, useRef, useEffect } from 'react'

export interface AddressResult {
  displayName: string
  address: string
  city: string
  province: string
  postalCode: string
  country: string
  lat: number
  lon: number
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  address: {
    road?: string
    house_number?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
    country?: string
    country_code?: string
  }
}

// Cache locale per le ricerche
const searchCache = new Map<string, AddressResult[]>()
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minuti
const cacheTimestamps = new Map<string, number>()

// Funzione per pulire la cache scaduta
const cleanExpiredCache = () => {
  const now = Date.now()
  cacheTimestamps.forEach((timestamp, key) => {
    if (now - timestamp > CACHE_EXPIRY_MS) {
      searchCache.delete(key)
      cacheTimestamps.delete(key)
    }
  })
}

// Estrae la provincia dal risultato Nominatim
const extractProvince = (address: NominatimResult['address']): string => {
  // Per l'Italia, la provincia è spesso in county o state
  const county = address.county || ''
  // Cerca di estrarre il codice provincia (es. "Provincia di Milano" -> "MI")
  const provinceMatch = county.match(/Provincia di (\w+)/i)
  if (provinceMatch) {
    // Mappa delle province italiane più comuni
    const provinceMap: Record<string, string> = {
      'Milano': 'MI', 'Roma': 'RM', 'Napoli': 'NA', 'Torino': 'TO',
      'Palermo': 'PA', 'Genova': 'GE', 'Bologna': 'BO', 'Firenze': 'FI',
      'Bari': 'BA', 'Catania': 'CT', 'Venezia': 'VE', 'Verona': 'VR',
      'Messina': 'ME', 'Padova': 'PD', 'Trieste': 'TS', 'Taranto': 'TA',
      'Brescia': 'BS', 'Parma': 'PR', 'Prato': 'PO', 'Modena': 'MO',
      'Reggio Calabria': 'RC', 'Reggio Emilia': 'RE', 'Perugia': 'PG',
      'Livorno': 'LI', 'Ravenna': 'RA', 'Cagliari': 'CA', 'Foggia': 'FG',
      'Rimini': 'RN', 'Salerno': 'SA', 'Ferrara': 'FE', 'Sassari': 'SS',
      'Latina': 'LT', 'Monza': 'MB', 'Bergamo': 'BG', 'Siracusa': 'SR',
      'Como': 'CO', 'Varese': 'VA', 'Lecce': 'LE', 'Ancona': 'AN',
      'Pesaro': 'PU', 'Udine': 'UD', 'Pescara': 'PE', 'Trento': 'TN',
      'Bolzano': 'BZ', 'Vicenza': 'VI', 'Treviso': 'TV', 'Novara': 'NO',
      'Piacenza': 'PC', 'Arezzo': 'AR', 'Alessandria': 'AL', 'Lucca': 'LU',
      'Pisa': 'PI', 'Lecco': 'LC', 'Catanzaro': 'CZ', 'Cosenza': 'CS',
      'Avellino': 'AV', 'Benevento': 'BN', 'Caserta': 'CE', 'Frosinone': 'FR',
      'Grosseto': 'GR', 'Imperia': 'IM', 'Isernia': 'IS', 'Lodi': 'LO',
      'Mantova': 'MN', 'Massa': 'MS', 'Matera': 'MT', 'Nuoro': 'NU',
      'Oristano': 'OR', 'Pordenone': 'PN', 'Potenza': 'PZ', 'Ragusa': 'RG',
      'Rieti': 'RI', 'Rovigo': 'RO', 'Savona': 'SV', 'Siena': 'SI',
      'Sondrio': 'SO', 'Teramo': 'TE', 'Terni': 'TR', 'Trapani': 'TP',
      'Vercelli': 'VC', 'Viterbo': 'VT'
    }
    return provinceMap[provinceMatch[1]] || provinceMatch[1].substring(0, 2).toUpperCase()
  }
  return county.substring(0, 2).toUpperCase() || ''
}

// Estrae la città dal risultato Nominatim
const extractCity = (address: NominatimResult['address']): string => {
  return address.city || address.town || address.village || address.municipality || ''
}

// Estrae l'indirizzo stradale dal risultato Nominatim
const extractStreetAddress = (address: NominatimResult['address']): string => {
  const parts: string[] = []
  if (address.road) parts.push(address.road)
  if (address.house_number) parts.push(address.house_number)
  return parts.join(', ')
}

// Trasforma il risultato Nominatim in AddressResult
const transformNominatimResult = (result: NominatimResult): AddressResult => {
  const address = result.address
  return {
    displayName: result.display_name,
    address: extractStreetAddress(address),
    city: extractCity(address),
    province: extractProvince(address),
    postalCode: address.postcode || '',
    country: address.country_code?.toUpperCase() || 'IT',
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon)
  }
}

export function useAddressAutocomplete(debounceMs: number = 300) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AddressResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Funzione di ricerca con Nominatim
  const searchAddress = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([])
      return
    }

    // Pulisci cache scaduta
    cleanExpiredCache()

    // Controlla se abbiamo risultati in cache
    const cacheKey = searchQuery.toLowerCase().trim()
    if (searchCache.has(cacheKey)) {
      setResults(searchCache.get(cacheKey)!)
      return
    }

    // Cancella richiesta precedente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        format: 'json',
        addressdetails: '1',
        limit: '5',
        countrycodes: 'it', // Limita all'Italia
        'accept-language': 'it'
      })

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          signal: abortControllerRef.current.signal,
          headers: {
            'User-Agent': 'NosciteCRM/1.0' // Richiesto da Nominatim
          }
        }
      )

      if (!response.ok) {
        throw new Error('Errore nella ricerca dell\'indirizzo')
      }

      const data: NominatimResult[] = await response.json()
      const transformedResults = data.map(transformNominatimResult)

      // Salva in cache
      searchCache.set(cacheKey, transformedResults)
      cacheTimestamps.set(cacheKey, Date.now())

      setResults(transformedResults)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return // Richiesta cancellata, ignora
      }
      setError('Errore durante la ricerca. Riprova.')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Effetto per il debounce
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (query.length >= 3) {
      debounceTimerRef.current = setTimeout(() => {
        searchAddress(query)
      }, debounceMs)
    } else {
      setResults([])
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, debounceMs, searchAddress])

  // Cleanup al unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const clearResults = useCallback(() => {
    setResults([])
    setQuery('')
  }, [])

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearResults
  }
}
