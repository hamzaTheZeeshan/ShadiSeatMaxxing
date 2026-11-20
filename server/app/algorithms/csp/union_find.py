class UnionFind:
    """Union-find whose root is always the smallest id, so groups are deterministic."""

    def __init__(self) -> None:
        self._parent: dict[str, str] = {}

    def find(self, item: str) -> str:
        root = item
        while True:
            parent = self._parent.get(root)
            if parent is None or parent == root:
                break
            root = parent
        current = item
        while current != root:
            nxt = self._parent.get(current)
            self._parent[current] = root
            if nxt is None:
                break
            current = nxt
        return root

    def union(self, a: str, b: str) -> None:
        root_a = self.find(a)
        root_b = self.find(b)
        if root_a == root_b:
            return
        if root_a < root_b:
            self._parent[root_b] = root_a
        else:
            self._parent[root_a] = root_b