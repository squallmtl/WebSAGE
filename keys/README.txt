
On linux:
---------

To recreate the key database:

rm -fr ~/.pki/nssdb
mkdir -p  ~/.pki/nssdb
certutil -d sql:$HOME/.pki/nssdb -N

