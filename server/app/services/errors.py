class DomainError(Exception):
    """Base class for errors raised by the service layer."""

    code: str = "domain_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class InvalidLayoutError(DomainError):
    code = "invalid_layout"