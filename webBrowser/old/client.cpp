#include "client.h"

Client::Client(boost::asio::io_service& io_service, const std::string& server, const std::string& port) :
    mSocket(io_service),
    mServer(server),
    mPort(port) {
        boost::asio::ip::tcp::resolver resolver(io_service);
        boost::asio::ip::tcp::resolver::query query(mServer, port);
        mResolver = resolver.resolve(query);
}

void Client::connect() {
    boost::asio::connect(mSocket, mResolver);
}
