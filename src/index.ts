import { Hono } from 'hono'
import { cache } from 'hono/cache'
import { proxy } from 'hono/proxy'
import { bearerAuth } from 'hono/bearer-auth'

type Bindings = {
  API_KEY: string
  IF_LIVE_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(
  '/api/*',
  bearerAuth({
    verifyToken: async (token, c) => {
		return token === (c.env as Bindings | undefined)?.API_KEY
    },
  })
)

app.get(
	'/api/live/*',
	cache({
		cacheName: 'api-cache',
		cacheControl: 'max-age=60', // 1 min
	}),
	async (c) => {
		const path = c.req.path.replace('/api/live/', '')

		const proxyRes = await proxy(
			`https://api.infiniteflight.com/public/v2/${path}`,
			{
                headers: {
                    // /!\ only send explicit headers
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${c.env.IF_LIVE_API_KEY}`,
                },
            }
        )

		const allowedHeaders = [
			'content-type',
			'cache-control',
			'content-length',
			'date',
			'last-modified',
			'server',
			'strict-transport-security',
		]
        
        // remove disallowed headers from response
        const filteredHeaders = new Headers()
		for (const [key, value] of proxyRes.headers.entries()) {
			if (allowedHeaders.includes(key.toLowerCase())) {
				filteredHeaders.set(key, value)
			}
		}

		// create a new response with the filtered headers
		return new Response(proxyRes.body, {
			status: proxyRes.status,
			statusText: proxyRes.statusText,
			headers: filteredHeaders
		})
	}
)

export default app
