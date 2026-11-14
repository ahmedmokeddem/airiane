"""LOCAL TEST ONLY. TLS termination + signed JWT fixture. Never a deployment service."""

import http.client
import json
import ssl
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import jwt
from cryptography.hazmat.primitives import serialization

key = serialization.load_pem_private_key(Path("/fixtures/jwt.key").read_bytes(), password=None)
jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
jwk.update(kid="fixture-key", alg="RS256", use="sig")
SUBJECTS = {
    "patient": "11111111-1111-4111-8111-111111111111",
    "clinician": "44444444-4444-4444-8444-444444444444",
    "other": "33333333-3333-4333-8333-333333333333",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request()

    def do_PATCH(self):
        self.handle_request()

    def do_DELETE(self):
        self.handle_request()

    def do_OPTIONS(self):
        self.handle_request()

    def handle_request(self):
        host = self.headers.get("Host", "").split(":")[0]
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if host == "auth.fixture.test":
            if self.path == "/auth/v1/.well-known/jwks.json":
                result = {"keys": [jwk]}
            elif self.path.startswith("/auth/v1/token"):
                data = json.loads(body)
                who = data.get("email", "").split("@")[0]
                if who not in SUBJECTS or data.get("password") != "local-fixture-password":
                    self.send_error(401)
                    return
                result = {
                    "access_token": jwt.encode(
                        {
                            "sub": SUBJECTS[who],
                            "iss": "https://auth.fixture.test/auth/v1",
                            "aud": "authenticated",
                            "exp": int(time.time()) + 600,
                        },
                        key,
                        algorithm="RS256",
                        headers={"kid": "fixture-key"},
                    ),
                    "expires_in": 600,
                }
            else:
                self.send_error(404)
                return
            payload = json.dumps(result).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        dest = {
            "api.fixture.test": ("airiane-api", 8000),
            "portal.fixture.test": ("airiane-portal", 3000),
        }.get(host)
        if not dest:
            self.send_error(404)
            return
        connection = http.client.HTTPConnection(*dest, timeout=90)
        try:
            headers = {
                k: v
                for k, v in self.headers.items()
                if k.lower() not in ("connection", "transfer-encoding")
            }
            connection.request(self.command, self.path, body=body, headers=headers)
            response = connection.getresponse()
            payload = response.read()
            self.send_response(response.status)
            for k, v in response.getheaders():
                if k.lower() not in ("transfer-encoding", "connection", "content-length"):
                    self.send_header(k, v)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        finally:
            connection.close()


server = ThreadingHTTPServer(("0.0.0.0", 443), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain("/fixtures/gateway.crt", "/fixtures/gateway.key")
server.socket = context.wrap_socket(server.socket, server_side=True)
server.serve_forever()
