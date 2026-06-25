# Webhook Setup — GitHub → Jenkins

Automatically trigger the CI/CD pipeline when code is pushed to GitHub.

---

## 1. Jenkins Side

### A. Install GitHub plugin
- **Manage Jenkins** → **Plugins** → **Available plugins**
- Search and install: **GitHub Integration Plugin** (includes webhook support)

### B. Configure Jenkins system
- **Manage Jenkins** → **System**
- Under **GitHub** → **Add GitHub Server**:
  - Name: `GitHub`
  - API URL: `https://api.github.com`
  - Credentials: select your `github-credentials` (PAT)
  - **Test connection** → should succeed

### C. Configure pipeline job
- Open your pipeline job → **Configure**
- **Build Triggers** → Check:
  - `GitHub hook trigger for GITScm polling`
- The `snake-game-pipeline-token` auth token is already set in `jenkins/snake-game-pipeline.xml` (line 55) for optional URL-triggered builds.

---

## 2. GitHub Side

Go to your repo: `https://github.com/Nayannyk/snake-game/settings/hooks`

### Add webhook
| Field | Value |
|---|---|
| **Payload URL** | `http://<JENKINS_URL>/github-webhook/` |
| **Content type** | `application/json` |
| **Secret** | (leave blank, or set one and configure in Jenkins) |
| **SSL verification** | Enable if Jenkins has HTTPS, otherwise **Disable** |
| **Which events?** | **Just the push event** (or select individual events) |
| **Active** | ✅ Checked |

> **Replace `<JENKINS_URL>`** with your Jenkins server address, e.g.:
> - `http://jenkins.example.com:8080/github-webhook/`
> - `http://192.168.1.100:8080/github-webhook/`

### Click **Add webhook**

---

## 3. Verify

1. Push a change to `main` or `develop` branch
2. GitHub sends a POST to `/github-webhook/` with event payload
3. Jenkins pipeline triggers automatically
4. Check webhook delivery status in GitHub: Settings → Webhooks → Recent Deliveries

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `404` on webhook URL | Append trailing `/`: `/github-webhook/` |
| Jenkins behind NAT | Use a tunnel (ngrok, serveo) or reverse proxy |
| "No triggered jobs" | Ensure job has **GitHub hook trigger** checked and branch matches |
| Auth token alternative | Use `http://JENKINS_URL/job/snake-game-pipeline/buildWithParameters?token=snake-game-pipeline-token` with a **Push** webhook event |
