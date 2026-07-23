# Mojaloop SDK Mock DFSP Backend

This package contains an HTTP server which provides a basic implementation of the Mojaloop SDK simplified DFSP backend API for education, demonstration and testing purposes.

## Usage

To run the mock backend in conjunction with the Mojaloop SDK scheme adapter:

1. Clone this repository locally.
2. From a terminal `cd` to the root of the repository.
3. ...

```
cd src
docker-compose up
```

For information on the Mojaloop SDK simplified DFSP backend API please see the openapi specification [here](https://github.com/mojaloop/sdk-scheme-adapter/blob/master/docs/dfspInboundApi.yaml)

This package is available as a pre-built docker image on Docker Hub: [https://hub.docker.com/r/mojaloop/sdk-mock-dfsp-backend](https://hub.docker.com/r/mojaloop/sdk-mock-dfsp-backend)
