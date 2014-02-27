@echo off

set password=foobar
set server=%1

rem echo "Start: CA"
win32\openssl genrsa -des3 -out ca.key  -passout pass:%password% 1024
win32\openssl req -new -key ca.key -out ca.csr -passin pass:%password% -subj "/CN=%server%"  -config win32\openssl.cnf
win32\openssl x509 -req -days 365 -in ca.csr -out %server%-ca.crt -signkey ca.key  -passin pass:%password%
rem echo ""
rem echo ""

rem FQDN - hostname (webserver)
rem echo "Start Server Certificate"
win32\openssl genrsa -des3 -out %server%-server.key -passout pass:%password% 1024
win32\openssl req -new -key %server%-server.key -out server.csr -passin pass:%password% -subj "/CN=%server%" -config win32\openssl.cnf
rem echo ""
rem echo ""

rem echo "Copy Server Certificate"
copy %server%-server.key server.key.org
win32\openssl rsa -in server.key.org -out %server%-server.key -passin pass:%password%
rem echo ""
rem echo ""

rem echo "Sign Server Certificate"
win32\openssl x509 -req -days 365 -in server.csr -signkey %server%-server.key -out %server%-server.crt
rem echo ""
rem echo ""

rem echo "Trust Server Certificate - Add to DB"
rem delete the previous server key
certutil -delstore root  %server%-server.crt
rem add the new key
certutil -addstore root  %server%-server.crt

del server.key.org server.csr ca.csr ca.key


