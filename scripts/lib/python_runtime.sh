#!/bin/bash
#
# Shared Python runtime selection for Property Analytics automation wrappers.
#

pa_select_python_runtime() {
  if [[ -n "${PROPERTY_ANALYTICS_PYTHON:-}" && -x "${PROPERTY_ANALYTICS_PYTHON}" ]]; then
    printf '%s\n' "${PROPERTY_ANALYTICS_PYTHON}"
    return 0
  fi

  if [[ -x "/usr/local/bin/python3" ]]; then
    printf '%s\n' "/usr/local/bin/python3"
    return 0
  fi

  if [[ -x "/Library/Frameworks/Python.framework/Versions/3.12/bin/python3" ]]; then
    printf '%s\n' "/Library/Frameworks/Python.framework/Versions/3.12/bin/python3"
    return 0
  fi

  printf '%s\n' "python3"
}
