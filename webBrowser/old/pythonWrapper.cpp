#include <boost/python.hpp>
using namespace boost::python;

BOOST_PYTHON_MODULE(hello)
{
    class_<Browser>("Browser")
        .def("greet", &World::greet)
    ;
}
