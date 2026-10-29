# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 15, section: blocking
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Count assignments for 15 distinct pots and fixed treatment totals of 5 each.
# This code counts the stated randomization spaces; it does not randomize an experiment.
treatments <- c("A","B","C")
blocks <- 5
pots_per_block <- 3
N <- blocks*pots_per_block
# Enumerate the legal label orders for one complete block.
orders <- expand.grid(position1=treatments,position2=treatments,
                      position3=treatments,stringsAsFactors=FALSE)
legal <- apply(orders,1,function(z) length(unique(z))==pots_per_block)
orders <- orders[legal,,drop=FALSE]
print(orders,row.names=FALSE)
rcbd_count <- nrow(orders)^blocks
# Choose the five A pots, then the five B pots; the remaining pots receive C.
crd_count <- choose(N,5)*choose(N-5,5)
crd_factorial_check <- factorial(N)/factorial(5)^3
# Under the specified uniform CRD, every complete-block layout is also possible.
chance_complete_blocks <- rcbd_count/crd_count
print(c(RCBD_assignments=rcbd_count,CRD_assignments=crd_count,
        CRD_probability_of_one_each_per_block=chance_complete_blocks))
stopifnot(nrow(orders)==6,rcbd_count==7776,crd_count==756756,
          abs(crd_count-crd_factorial_check)<1e-8,
          chance_complete_blocks>0,chance_complete_blocks<1)
