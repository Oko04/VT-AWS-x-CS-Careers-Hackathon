# LegalEase

Translate legal language into plain English.

Paste or upload a legal document — contract, privacy policy, terms of service, or legislation — and get a plain-English breakdown of what it means, what you're agreeing to, the risks, and what personal data is being collected. Key claims are backed by real case law from CourtListener.

## Live Demo

> [Add your Vercel URL here once deployed.](https://vt-aws-x-cs-careers-hackathon-eu6c.vercel.app/)

## Features

- Paste text or upload a PDF
- AI-powered analysis via Claude (Anthropic)
- Color-coded output: summary, obligations, risks, personal data, agreements
- Legal citations backed by CourtListener case law
- Fully responsive, keyboard accessible

## Running Locally

**Prerequisites**
- [Node.js](https://nodejs.org) (LTS)
- [Anthropic API key](https://console.anthropic.com) — free $5 credit on signup, no credit card required
- [CourtListener API token](https://www.courtlistener.com) — free account

**Setup**

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
npm install
```

Create a `.env.local` file in the project root:

```
ANTHROPIC_API_KEY=your_anthropic_key_here
COURTLISTENER_API_KEY=your_courtlistener_token_here
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Import your repository
4. Leave Root Directory and Build Settings as default
5. Add environment variables:
   - `ANTHROPIC_API_KEY`
   - `COURTLISTENER_API_KEY`
6. Deploy

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- [Tailwind CSS](https://tailwindcss.com)
- [Anthropic Claude](https://anthropic.com) — AI analysis
- [CourtListener](https://courtlistener.com) — legal citations
