#!/bin/sh

# phony password
password=foobar
server=iridium.evl.optiputer.net

echo "Start: CA"
openssl genrsa -des3 -out ca.key  -passout pass:$password 1024
openssl req -new -key ca.key -out ca.csr -passin pass:$password -subj "/CN=$server/O=UIC/C=US"
openssl x509 -req -days 365 -in ca.csr -out ca.crt -signkey ca.key  -passin pass:$password
echo ""
echo ""

#FQDN - hostname (webserver)
echo "Start Server Certificate"
openssl genrsa -des3 -out server.key -passout pass:$password 1024
openssl req -new -key server.key -out server.csr -passin pass:$password -subj "/CN=$server/O=UIC/C=US"
echo ""
echo ""

echo "Copy Server Certificate"
cp server.key server.key.org
openssl rsa -in server.key.org -out server.key -passin pass:$password
echo ""
echo ""

echo "Sign Server Certificate"
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
echo ""
echo ""

echo "Trust Server Certificate - Add to DB"
certutil -d sql:$HOME/.pki/nssdb -L
certutil -d sql:$HOME/.pki/nssdb -D -t "P,," -n $server -i server.crt
certutil -d sql:$HOME/.pki/nssdb -A -t "P,," -n $server -i server.crt
certutil -d sql:$HOME/.pki/nssdb -L
echo ""
echo "Finished"
