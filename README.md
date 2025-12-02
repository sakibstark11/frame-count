# frame-count
The project uses devcontainer for development purposes. Ensure you have
- Docker installed and running

You should then be able to hit `control + shift + p` in any vscode forks and type `Dev Containers: Reopen in Container`

to test the api, run the following from the root of the repo
```
curl -X POST -F "file=@tests/fixtures/sample.mp3" http://localhost:3000/file-upload
```
