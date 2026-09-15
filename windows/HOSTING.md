# RCC PINGPONG NIGHT — Windows hosting

This package runs on Windows with Node.js 24 or newer and a local SQLite database. The existing Sites URL remains a separate deployment; this package starts with an empty club until a state backup is imported.

## Run locally

1. Install Node.js 24 or newer from https://nodejs.org/ on the Windows computer that will stay on during use.
2. Put this entire package in a permanent folder, such as `C:\RCC-Pingpong`.
3. Run `Start-Pong.ps1` from PowerShell. It creates a private `.env` file on first launch, binds to 127.0.0.1:3000, and automatically applies the bundled database migrations.
4. Open http://localhost:3000. Use **Set up manager** and the `SETUP_KEY` in `.env` to choose your manager username/password. Subsequent managers can be added by a signed-in manager. Passwords only need to be nonblank.
5. Keep the app running. Data lives in `data\pong.sqlite`. For a simple consistent backup, stop the app and copy the whole `data` folder and `.env` to a private backup location. Keep them out of web-served folders.

## Put a Cloudflare link in front of it

Use a named Cloudflare Tunnel with a domain in your Cloudflare account for a stable address.

1. In the Cloudflare dashboard, create a tunnel and choose the Windows connector instructions. Install `cloudflared` using Cloudflare's official instructions and install the tunnel service with the dashboard-generated token. The token is secret; don't paste it into this repository or share it.
2. Add a published application route for your chosen hostname, such as `pong.kor.red`. Set the service to **HTTP**, `localhost:3000`.
3. In the app's `.env`, add `PUBLIC_ORIGIN=https://pong.kor.red` using your actual hostname, with no trailing slash. Restart the app. This ensures origin checks and secure session cookies use the public HTTPS address.
4. If the goal is public read-only access, do not place a Cloudflare Access login policy in front of this hostname. The app itself protects manager writes using username/password; ordinary visitors can see rosters and nights. Manager notes require sign-in.
5. Send people the HTTPS link. The Windows computer, application and tunnel must stay running. No router port forwarding is needed for the tunnel.

For unattended operation, configure Task Scheduler to start the app at startup under the intended Windows account with the permanent package folder as its working directory. Test reboot and backup recovery before relying on it for a night. This package does not change Windows startup settings or install the tunnel automatically.

Official references:
- https://developers.cloudflare.com/tunnel/setup/
- https://developers.cloudflare.com/tunnel/routing/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/windows/

## Move the existing roster and nights

At cutover, obtain a manager-authorized `/api/state` JSON export from the existing app (it includes private player notes). Keep it private. Stop the Windows app, put the export outside public folders, and run:

    node --env-file-if-exists=.env import-state.mjs path-to-backup.json

Import refuses to overwrite a populated club. Player identities, results, ranks, reset exclusions and audit history are retained. Usernames/passwords are not in the state export, so create the manager account separately on the Windows installation. Do not operate both copies as writable clubs after cutover: they do not synchronize.

## Update

Build/extract a new package into a new folder. Stop the previous app and copy its `.env` and entire `data` folder into the new package, then start it. Retain a backup and the previous package. Do not overwrite a running database. Applied migrations are checked by checksum.
