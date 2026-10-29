alpha_family <- 0.05; m <- 3
answer <- alpha_family/m
print(answer)
p.adjust(c(0.012,0.020,0.200),method="bonferroni")
