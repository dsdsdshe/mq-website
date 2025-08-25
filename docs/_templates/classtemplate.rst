{{ fullname }}
{{ '=' * fullname|length }}

.. currentmodule:: {{ module }}

{% if objname and objname[0].isupper() %}
.. autoclass:: {{ fullname }}
   :members:
   :undoc-members:
   :show-inheritance:
{% else %}
.. autofunction:: {{ fullname }}
{% endif %}

