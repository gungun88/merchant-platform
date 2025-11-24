import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessResult {
  processed_count: number
  failed_count: number
  details: any[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting group rewards processing...')

    // Call the database function to process rewards
    const { data, error } = await supabase.rpc('process_group_rewards')

    if (error) {
      console.error('Error processing group rewards:', error)
      throw error
    }

    const result = data[0] as ProcessResult

    console.log('Group rewards processing completed:', {
      processed: result.processed_count,
      failed: result.failed_count,
      details: result.details
    })

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully processed ${result.processed_count} rewards`,
        processed: result.processed_count,
        failed: result.failed_count,
        details: result.details,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error in process-group-rewards function:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
