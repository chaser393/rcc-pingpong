# RCC PINGPONG NIGHT on Docker

This runs the complete app on a Linux Docker host (including Docker Desktop in Linux container mode). It builds for the host's CPU architecture. No Node installation is needed on the host. Run one app instance with its local SQLite volume; this is not a multi-replica database setup.

## Start

1. Extract the Docker source package into a permanent folder on your server.
2. Copy `docker.env.example` to `docker.env`. Fill in `SETUP_KEY` with a private setup key of your choosing. Leave `PUBLIC_ORIGIN` empty for initial LAN access.
3. From that folder run:

   ```sh
   docker compose --env-file docker.env up -d --build
   ```

4. Open `http://YOUR-SERVER-IP:3000`. Choose **Set up manager**, enter the setup key, and choose your username/password. Passwords only need to be nonblank. This starts an empty club; see migration below for your current roster/history.
5. Check status with `docker compose --env-file docker.env ps`. Read errors with `docker compose --env-file docker.env logs --tail=100 pong`.

The image runs as a non-root user. The named volume `rcc-pingpong_pong-data` stores players, nights, scores, manager accounts and sessions. Container replacement and normal `docker compose down` retain it. **Do not use `down -v` or delete that volume unless you intend to erase the data.** Keep `docker.env` private and outside version control. The build excludes credentials and existing databases.

## Your domain / Cloudflare

Set `PUBLIC_ORIGIN=https://pong.kor.red` in `docker.env` when that is the address you use. Apply changes with `docker compose --env-file docker.env up -d`. This gives login cookies the Secure flag and makes write origin checks use the public HTTPS address. Use that address for manager actions afterward.

Route your existing reverse proxy or Cloudflare Tunnel to port 3000 on this Docker host. If cloudflared runs on the same host outside Docker, use `http://localhost:3000`. If it runs in another container on the same Docker network, use `http://pong:3000`; localhost inside that container would refer to cloudflared itself. For a host-local proxy, optionally set `PONG_BIND_IP=127.0.0.1`. This package does not create DNS records or a tunnel. Public visitors can read; managers sign in to edit.

## Transfer the current roster and nights

On the current live site, sign in as a manager, then open `/api/state` on that same site and save the returned JSON as `pong-backup.json`. This export includes private notes, so keep it private. Copy it beside the Docker project on the new host.

Stop the app, then import into an empty club:

```sh
docker compose --env-file docker.env stop pong
docker compose --env-file docker.env run --rm --no-deps -v "./pong-backup.json:/backup.json:ro" pong node import-state.mjs /backup.json
docker compose --env-file docker.env up -d
```

Import refuses to overwrite existing players/nights. It retains player IDs, scores, reset exclusions, frozen PR snapshots and change history. Create manager accounts separately; account passwords are not included in the JSON export. Verify totals after import and use only the new installation for further scoring, since the two sites do not synchronize. Remove the exported JSON from the project folder after storing a private backup.

## Back up or move an existing Docker installation

For a consistent backup, stop the app before copying the whole database directory (including SQLite sidecar files):

```sh
docker compose --env-file docker.env stop pong
docker compose --env-file docker.env cp pong:/data ./pong-data-backup
docker compose --env-file docker.env start pong
```

Keep that backup, `docker.env`, and this source package. On another host, copy these files, run the following from the project folder, and verify your roster and login:

```sh
docker compose --env-file docker.env build
docker compose --env-file docker.env create pong
docker compose --env-file docker.env cp ./pong-data-backup/. pong:/data
docker compose --env-file docker.env run --rm --no-deps --user root pong chown -R node:node /data
docker compose --env-file docker.env up -d
```

Restore only into an empty new installation. Do not overwrite a running or populated database.

## Updates and image transfer

Back up first. Replace source files while retaining `docker.env` and the Docker volume, then run the start command with `--build` again. Database migrations apply automatically. Do not edit migrations that have already been applied.

To move a built image to a server with the same CPU architecture instead of rebuilding there:

```sh
docker image save -o rcc-pingpong-image.tar rcc-pingpong:local
# On the destination:
docker image load -i rcc-pingpong-image.tar
docker compose --env-file docker.env up -d --no-build
```

Copy `compose.yaml` and your private `docker.env` too. Images do not contain your live data; transfer the volume using the backup steps above.

References: [Docker volumes](https://docs.docker.com/engine/storage/volumes/) and [Compose environment files](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).
