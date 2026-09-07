XOR_CODE = 23442827791579
BASE = 58
DATA = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf'
POS = [11, 10, 3, 8, 4, 6, 5, 7, 9]
def av2bv(av: int) -> str:
    x = (av | (1 << 51)) ^ XOR_CODE
    r = list('BV1000000000')
    for i in range(9):
        r[POS[i]] = DATA[x % BASE]; x //= BASE
    return ''.join(r)
