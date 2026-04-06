#!/usr/bin/env python3
"""Dev server with no-cache headers — prevents stale module cache in browser."""
import http.server, socketserver, os

PORT = 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, fmt, *args):
        print(f'  {args[0]} {args[1]}')

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'Serving at http://localhost:{PORT}/')
    httpd.serve_forever()
