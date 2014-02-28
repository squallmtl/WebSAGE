#!/bin/sh

# clean up
# /bin/rm -f *.crt *.csr *.key *.org

# phony password
password=foobar
#server=$HOSTNAME
#server=iridium.evl.optiputer.net
server=$1

echo "Start: CA"
openssl genrsa -des3 -out ca.key  -passout pass:$password 1024
openssl req -new -key ca.key -out ca.csr -passin pass:$password -subj "/CN=$server"
openssl x509 -req -days 365 -in ca.csr -out $server-ca.crt -signkey ca.key  -passin pass:$password
echo ""
echo ""

#FQDN - hostname (webserver)
echo "Start Server Certificate"
openssl genrsa -des3 -out $server-server.key -passout pass:$password 1024
openssl req -new -key $server-server.key -out server.csr -passin pass:$password -subj "/CN=$server"
echo ""
echo ""

echo "Copy Server Certificate"
cp $server-server.key server.key.org
openssl rsa -in server.key.org -out $server-server.key -passin pass:$password
echo ""
echo ""

echo "Sign Server Certificate"
openssl x509 -req -days 365 -in server.csr -signkey $server-server.key -out $server-server.crt
echo ""
echo ""

# add the new key
# sudo /usr/bin/security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain localhost-server.crt
/usr/bin/security add-trusted-cert -d -r trustRoot localhost-server.crt

echo ""
echo "Finished"

/bin/rm -f server.key.org server.csr ca.csr ca.key


