import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"

export interface ItalianCity {
  id: string
  province_code: string
  province_name: string
  city_name: string
  postal_code: string
  region: string
}

export interface Province {
  code: string
  name: string
  region: string
}

export function useItalianCities() {
  const [provinces, setProvinces] = useState<Province[]>([])
  const [cities, setCities] = useState<ItalianCity[]>([])
  const [postalCodes, setPostalCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadProvinces()
  }, [])

  const loadProvinces = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('italian_cities')
        .select('province_code, province_name, region')
        .order('province_name')

      if (error) throw error

      const uniqueProvinces = data?.reduce((acc: Province[], item) => {
        const existing = acc.find(p => p.code === item.province_code)
        if (!existing) {
          acc.push({
            code: item.province_code,
            name: item.province_name,
            region: item.region
          })
        }
        return acc
      }, []) || []

      setProvinces(uniqueProvinces)
    } catch (error) {
      console.error('Error loading provinces:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCitiesByProvince = async (provinceCode: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('italian_cities')
        .select('*')
        .eq('province_code', provinceCode)
        .order('city_name')

      if (error) throw error
      setCities(data || [])
    } catch (error) {
      console.error('Error loading cities:', error)
      setCities([])
    } finally {
      setLoading(false)
    }
  }

  const searchCities = async (searchTerm: string, provinceCode?: string) => {
    if (searchTerm.length < 2) {
      setCities([])
      return []
    }

    setLoading(true)
    try {
      let queryBuilder = supabase
        .from('italian_cities')
        .select('*')
        .ilike('city_name', `%${searchTerm}%`)

      if (provinceCode) {
        queryBuilder = queryBuilder.eq('province_code', provinceCode)
      }

      const { data, error } = await queryBuilder
        .order('city_name')
        .limit(20)

      if (error) throw error
      
      const results = data || []
      setCities(results)
      return results
    } catch (error) {
      console.error('Error searching cities:', error)
      setCities([])
      return []
    } finally {
      setLoading(false)
    }
  }

  const getPostalCodesByCity = async (cityName: string, provinceCode?: string) => {
    try {
      let queryBuilder = supabase
        .from('italian_cities')
        .select('postal_code')
        .eq('city_name', cityName)

      if (provinceCode) {
        queryBuilder = queryBuilder.eq('province_code', provinceCode)
      }

      const { data, error } = await queryBuilder

      if (error) throw error
      
      const codes = data?.map(item => item.postal_code).sort() || []
      setPostalCodes(codes)
      return codes
    } catch (error) {
      console.error('Error loading postal codes:', error)
      setPostalCodes([])
      return []
    }
  }

  return {
    provinces,
    cities,
    postalCodes,
    loading,
    getCitiesByProvince,
    searchCities,
    getPostalCodesByCity
  }
}