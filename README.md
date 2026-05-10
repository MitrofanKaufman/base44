**Welcome to your Base44 project** 

**About**

View and Edit  your app on [Base44.com](http://Base44.com) 

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://127.0.0.1:3000
VITE_BASE44_APP_ID=local
VITE_BASE44_APP_BASE_URL=
```

Run the backend dependencies: `docker compose up -d postgres redis`

Run the API: `cd backend && npm run dev`

Run the app: `npm run dev`

The first registered user is assigned the `admin` role.

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
