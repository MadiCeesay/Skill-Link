# Local MongoDB replica set for demos

Requires Docker Desktop running with Linux containers and Docker Compose v2 supporting `--wait`. Before going offline, pull the image while connected:

```powershell
docker compose pull
```

Run commands in the Skill-Link repository root. Start the database with one command:

```powershell
docker compose up -d --wait
```

The root `compose.yaml` starts MongoDB 7, initiates a single-node `rs0` replica set automatically, and waits for a writable primary. This supports the marketplace's multi-document transactions. Port 27017 is exposed only on 127.0.0.1; this local demo database has no authentication and must stay on loopback. Free port 27017 before starting it.

Keep a private copy of your working Atlas configuration. Change only the following value in `backend/.env` to select the local database:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/skilllink?replicaSet=rs0&directConnection=true
```

`directConnection=true` allows the host-run Node backend to use the published loopback port despite MongoDB's internal replica-set hostname. Keep existing JWT secrets and frontend origin. Restart the backend after switching the URI. From `backend`, run `npm run seed:admin` after setting ADMIN_* as described in the README, then `npm run dev`. Start the frontend normally and use http://localhost:5173.

This is a separate database, initially empty. It does **not** automatically back up, sync or restore Atlas. Before your demo, create the catalog using the admin workspace and register local customer/worker accounts, then complete verification/profile setup. Existing Atlas logins and bookings do not appear locally. Sign out and sign in again after switching databases; browser tokens from one database are not a portable login for the other.

Docker retains local data in the `skilllink-local_mongo-data` named volume across container restarts and `docker compose down`. Start it again with the same one-command startup. To stop containers while keeping records:

```powershell
docker compose down
```

Do not add `-v` unless you intend to permanently erase the local database. Return to Atlas by restoring your private original MONGODB_URI and restarting the backend.

Once the Docker image and npm dependencies are cached, database, authentication, catalog, bookings and simulated payments can run offline. Cloudinary uploads and remotely hosted images still require internet; the Compose database does not provide an offline media service. `MEDIA_PROVIDER=disabled` permits backend startup without Cloudinary, but does not implement uploads. For a fully offline rehearsal, avoid new media uploads and test the remaining flows in advance.

Verify the replica set and API after startup:

```powershell
docker compose exec mongo mongosh --quiet --eval "db.hello().isWritablePrimary"
Invoke-RestMethod http://localhost:5000/api/ready
```

The first command should print `true`; the second should return a successful readiness response.
