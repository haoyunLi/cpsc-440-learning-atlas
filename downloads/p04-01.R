pA <- 0.25; pB <- 0.70; pAB <- 0.40
bounds <- c(max(0, pA + pB - 1), min(pA, pB))
print(bounds)
print(pAB >= bounds[1] && pAB <= bounds[2])
